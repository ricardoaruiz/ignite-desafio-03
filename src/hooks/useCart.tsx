import React from 'react';
import { createContext, ReactNode, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product, Stock } from '../types';

const CART_KEY_LS = '@RocketShoes:cart'

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const storagedCart = window.localStorage.getItem(CART_KEY_LS)

    if (storagedCart) {
      return JSON.parse(storagedCart);
    }

    return [];
  });

  const addProduct = React.useCallback(async (productId: number) => {
    try {
      // get stock from backend
      const response = await api.get<Stock>(`stock/${productId}`);
      const { data: stock } = response

      if (stock.amount <= 1) {
        toast.error('Quantidade solicitada fora de estoque');
        return;
      }

      // add item on cart
      const cartProduct = cart.find(item => item.id === productId);

      if (cartProduct) {
        const newCart = cart.map(item => {
          if (item.id === cartProduct.id) {
            return { ...cartProduct, amount: cartProduct.amount + 1};
          }
          return item;
        })
        setCart(newCart)
        window.localStorage.setItem(CART_KEY_LS, JSON.stringify(newCart))
      } else {
        const { data: product } = await api.get<Product>(`products/${productId}`);
        const newCart = [ ...cart, { ...product, amount: 1 } ]
        setCart(newCart);
        window.localStorage.setItem(CART_KEY_LS, JSON.stringify(newCart))
      }

      // update stock on backend
      await api.put(`stock/${productId}`, { ...stock, amount: stock.amount - 1 })

    } catch {
      toast.error('Erro na adição do produto');
    }
  }, [cart]);

  const removeProduct = async (productId: number) => {
    try {
        const cartItem = cart.find(item => item.id === productId)

        if (!cartItem) {
          throw new Error()
        }
        // const { data: stock } = await api.get<Stock>(`stock/${productId}`);
        // await api.put(`stock/${productId}`, { id: cartItem?.id, amount: stock.amount + cartItem!.amount })

        setCart(state => {
          const newState = state.filter(item => item.id !== productId);
          window.localStorage.setItem(CART_KEY_LS, JSON.stringify(newState));
          return newState
        })
    } catch {
      toast.error('Erro na remoção do produto');
    }
  };

  const updateProductAmount = React.useCallback(async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {

      if (amount <= 0 ) return

      const cartItem = cart.find(item => item.id === productId)

      if (!cartItem) throw new Error()

      const { data: stock } = await api.get<Stock>(`stock/${productId}`);

      const qt = amount - cartItem.amount

      if(qt > 0 && stock.amount <= 1) {
        toast.error('Quantidade solicitada fora de estoque');
        return;
      }

      const newCart = cart.map(item => {
        if (item.id === productId) {
          return { ...cartItem, amount: cartItem.amount + qt};
        }
        return item;
      })
      setCart(newCart)
      window.localStorage.setItem(CART_KEY_LS, JSON.stringify(newCart))

      await api.put(`stock/${productId}`, { id: cartItem?.id, amount: stock.amount - qt })

    } catch {
      toast.error('Erro na alteração de quantidade do produto');
    }
  }, [cart]);

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
