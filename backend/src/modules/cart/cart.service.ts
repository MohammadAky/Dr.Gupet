import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MAX_CART_ITEM_QTY } from '../../common/constants';
import { AppException } from '../../common/filters/all-exceptions.filter';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get cart with computed totals
   */
  async getCart(userId: number) {
    // Lazily create cart if missing
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    isActive: true,
                    images: { take: 1, select: { url: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      isActive: true,
                      images: { take: 1, select: { url: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    // Transform items with current prices and availability
    const items = cart.items.map((item) => {
      const variant = item.variant;
      const product = variant.product;
      const unitPrice = variant.price;
      const total = unitPrice * item.quantity;
      const available = variant.isActive && product.isActive && variant.stock >= item.quantity;

      let stockProblem: 'OUT_OF_STOCK' | 'INSUFFICIENT' | undefined;
      if (variant.stock <= 0) {
        stockProblem = 'OUT_OF_STOCK';
      } else if (variant.stock < item.quantity) {
        stockProblem = 'INSUFFICIENT';
      }

      return {
        id: item.id,
        variantId: variant.id,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.images[0]?.url || null,
        weightGram: variant.weightGram,
        unitPrice,
        quantity: item.quantity,
        total,
        available,
        stockProblem,
      };
    });

    const itemsTotal = items.reduce((sum, item) => sum + item.total, 0);

    return {
      items,
      itemsTotal,
    };
  }

  /**
   * Add item to cart (or increase quantity if already exists)
   */
  async addItem(userId: number, variantId: number, quantity: number = 1) {
    // Validate variant exists and is active
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { isActive: true } } },
    });

    if (!variant || !variant.isActive || !variant.product.isActive) {
      throw new AppException('VARIANT_UNAVAILABLE', 'این واریانت موجود نیست', 400);
    }

    // Check stock
    if (variant.stock < quantity) {
      throw new AppException('OUT_OF_STOCK', 'موجودی کافی نیست', 400);
    }

    // Get or create cart
    let cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await this.prisma.cart.create({ data: { userId } });
    }

    // Check if item already exists in cart
    const existingItem = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });

    if (existingItem) {
      // Increase quantity
      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity > MAX_CART_ITEM_QTY) {
        throw new AppException(
          'LIMIT_REACHED',
          `حداکثر تعداد ${MAX_CART_ITEM_QTY} است`,
          400,
        );
      }

      if (newQuantity > variant.stock) {
        throw new AppException('OUT_OF_STOCK', 'موجودی کافی نیست', 400);
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      // Create new item
      if (quantity > MAX_CART_ITEM_QTY) {
        throw new AppException(
          'LIMIT_REACHED',
          `حداکثر تعداد ${MAX_CART_ITEM_QTY} است`,
          400,
        );
      }

      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  /**
   * Update cart item quantity
   */
  async updateItem(userId: number, itemId: number, quantity: number) {
    // Get cart
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      throw new NotFoundException('سبد خرید یافت نشد');
    }

    // Get item and verify ownership
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { variant: true },
    });

    if (!item || item.cartId !== cart.id) {
      throw new NotFoundException('آیتم یافت نشد');
    }

    // Validate quantity
    if (quantity < 1 || quantity > MAX_CART_ITEM_QTY) {
      throw new AppException(
        'VALIDATION_ERROR',
        `تعداد باید بین ۱ و ${MAX_CART_ITEM_QTY} باشد`,
        400,
      );
    }

    // Check stock
    if (quantity > item.variant.stock) {
      throw new AppException('OUT_OF_STOCK', 'موجودی کافی نیست', 400);
    }

    // Update quantity
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    return this.getCart(userId);
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId: number, itemId: number) {
    // Get cart
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      throw new NotFoundException('سبد خرید یافت نشد');
    }

    // Get item and verify ownership
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.cartId !== cart.id) {
      throw new NotFoundException('آیتم یافت نشد');
    }

    // Delete item
    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.getCart(userId);
  }

  /**
   * Clear all items from cart
   */
  async clearCart(userId: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return { items: [], itemsTotal: 0 };
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.getCart(userId);
  }
}