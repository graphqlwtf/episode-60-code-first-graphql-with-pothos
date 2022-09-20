import { createServer } from "@graphql-yoga/node";
import SchemaBuilder from "@pothos/core";
import WithInputPlugin from "@pothos/plugin-with-input";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type Cart = {
  id: string;
  items?: CartItem[];
};

const builder = new SchemaBuilder<{
  Objects: {
    Cart: Cart;
    CartItem: CartItem;
  };
  Scalars: {
    ID: { Input: string; Output: string };
  };
}>({
  plugins: [WithInputPlugin],
});

const CARTS = [
  {
    id: "1",
    items: [
      {
        id: "1",
        name: "My item",
        price: 1000,
        quantity: 5,
      },
    ],
  },
];

const Money = builder.objectRef<number>("Money").implement({
  fields: (t) => ({
    amount: t.int({ resolve: (amount) => amount }),
    formatted: t.string({
      resolve: (amount) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount / 100),
    }),
  }),
});

builder.objectType("Cart", {
  fields: (t) => ({
    id: t.exposeString("id"),
    items: t.field({
      type: ["CartItem"],
      resolve: (cart) => cart.items ?? [],
    }),
    subTotal: t.field({
      type: Money,
      resolve: (cart) =>
        cart.items?.reduce(
          (acc, item) => acc + item.price * item.quantity,
          0
        ) ?? 0,
    }),
  }),
});

builder.objectType("CartItem", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    quantity: t.exposeInt("quantity"),
    lineTotal: t.field({
      type: Money,
      resolve: (item) => item.price * item.quantity,
    }),
    unitTotal: t.field({
      type: Money,
      resolve: (item) => item.price,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    cart: t.field({
      nullable: true,
      args: {
        id: t.arg.id({ required: true, description: "The ID of the cart!" }),
      },
      type: "Cart",
      resolve: (_, { id }) => {
        const cart = CARTS.find((c) => c.id === id);

        if (!cart) {
          throw new Error(`Not cart with ID: ${id}`);
        }

        return cart;
      },
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    addItem: t.fieldWithInput({
      input: {
        cartId: t.input.id({ required: true }),
        id: t.input.id({ required: true }),
        name: t.input.string({ required: true }),
        price: t.input.int({ required: true }),
        quantity: t.input.int({ required: true, defaultValue: 1 }),
      },
      type: "Cart",
      resolve: (_, { input: { cartId, ...input } }) => {
        const cart = CARTS.find((c) => c.id === cartId);

        if (!cart) {
          throw new Error(`Not cart with ID: ${cartId}`);
        }

        return {
          id: cartId,
          items: [...cart?.items, input],
        };
      },
    }),
  }),
});

const server = createServer({
  schema: builder.toSchema(),
});

server.start();
