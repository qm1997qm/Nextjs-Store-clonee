"use server";
import { redirect } from "next/navigation";
import db from "./db";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
    imageSchema,
    productSchema,
    reviewSchema,
    validateWithZodSchema,
} from "./schemas";
import { deleteImage, uploadImage } from "./supabase";
import { revalidatePath } from "next/cache";
import { Cousine } from "next/font/google";
import type { Cart } from "@prisma/client";

const renderError = (error: unknown) => {
    console.log(error);
    return {
        message: error instanceof Error ? error.message : "An error occurred",
    };
};

const getAuthUser = async () => {
    const user = await currentUser();
    if (!user) {
        throw new Error("You must bbe logged in to process this route");
    }
    return user;
};

const getAdminUser = async () => {
    const user = await getAuthUser();
    if (user.id !== process.env.ADMIN_USER_ID) redirect("/");
    return user;
};

export const fetchFeaturedProducts = async () => {
    const products = await db.product.findMany({
        where: {
            featured: true,
        },
    });
    return products;
};

export const fetchAllProducts = async ({ search = "" }: { search: string }) => {
    return await db.product.findMany({
        where: {
            OR: [
                { name: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
            ],
        },
        orderBy: {
            createdAt: "desc",
        },
    });
};

export const fetchSingleProduct = async (productId: string) => {
    const product = await db.product.findUnique({
        where: {
            id: productId,
        },
    });
    if (!product) redirect("/products");
    return product;
};

export const createProductAction = async (
    prevState: any,
    formData: FormData
): Promise<{ message: string }> => {
    try {
        const user = await getAuthUser();
        const file = formData.get("image") as File;
        const rawData = Object.fromEntries(formData);
        const validateFile = validateWithZodSchema(imageSchema, {
            image: file,
        });
        const validatedFields = validateWithZodSchema(productSchema, rawData);
        const fullPath = await uploadImage(validateFile.image);

        await db.product.create({
            data: {
                ...validatedFields,
                image: fullPath,
                clerkId: user.id,
            },
        });
    } catch (error) {
        return renderError(error);
    }
    redirect("/admin/products");
};

export const fetchAdminProducts = async () => {
    await getAdminUser();
    const products = await db.product.findMany({
        orderBy: {
            createdAt: "desc",
        },
    });
    return products;
};

export const deleteProductAction = async (prevState: { productId: string }) => {
    const { productId } = prevState;
    await getAdminUser();
    try {
        const product = await db.product.delete({
            where: {
                id: productId,
            },
        });
        await deleteImage(product.image);
        revalidatePath("/admin/products");
        return { message: "product removed" };
    } catch (error) {
        return renderError(error);
    }
};

// ### FetchAdminProductDetails, UpdateProductAction and updateProductImageAction
export const fetchAdminProductDetails = async (productId: string) => {
    await getAdminUser();
    const product = await db.product.findUnique({
        where: {
            id: productId,
        },
    });
    if (!product) redirect("/admin/products");
    return product;
};

export const updateProductAction = async (
    prevState: any,
    formData: FormData
) => {
    await getAdminUser();
    try {
        const productId = formData.get("id") as string;
        const rawData = Object.fromEntries(formData);
        const validatedFields = validateWithZodSchema(productSchema, rawData);
        await db.product.update({
            where: {
                id: productId,
            },
            data: {
                ...validatedFields,
            },
        });
        revalidatePath(`/admin/products/${productId}/edit`);
        return { message: "Product updated successfully" };
    } catch (error) {
        return renderError(error);
    }
};

export const updateProductImageAction = async (
    prevState: any,
    formData: FormData
) => {
    await getAdminUser();
    try {
        const image = formData.get("image") as File;
        const productId = formData.get("id") as string;
        const oldImageUrl = formData.get("url") as string;

        const validateFile = validateWithZodSchema(imageSchema, { image });
        const fullPath = await uploadImage(validateFile.image);
        await deleteImage(oldImageUrl);
        await db.product.update({
            where: {
                id: productId,
            },
            data: {
                image: fullPath,
            },
        });
        revalidatePath(`/admin/products/${productId}/edit`);
        return { message: "Product Image updated successfully" };
    } catch (error) {
        return renderError(error);
    }
};

// ### FetchFavoriteId
export const fetchFavoriteId = async ({ productId }: { productId: string }) => {
    const user = await getAuthUser();
    const favorite = await db.favorite.findFirst({
        where: {
            productId,
            clerkId: user.id,
        },
        select: {
            id: true,
        },
    });
    return favorite?.id || null;
};

export const toggleFavoriteAction = async (prevState: {
    productId: string;
    favoriteId: string | null;
    pathname: string;
}) => {
    const user = await getAuthUser();
    const { productId, favoriteId, pathname } = prevState;

    try {
        if (favoriteId) {
            await db.favorite.delete({
                where: {
                    id: favoriteId,
                },
            });
        } else {
            await db.favorite.create({
                data: {
                    productId,
                    clerkId: user.id,
                },
            });
        }
        revalidatePath(pathname);
        return { message: favoriteId ? "Remove form Faves" : "Added to Faves" };
    } catch (error) {
        return renderError(error);
    }
};

export const fetchUserFavorites = async () => {
    const user = await getAuthUser();
    const favorites = await db.favorite.findMany({
        where: {
            clerkId: user.id,
        },
        include: {
            product: true,
        },
    });
    return favorites;
};

// Reviews
export const createReviewAction = async (
    prevState: any,
    formData: FormData
) => {
    const user = await getAuthUser();
    try {
        const rawData = Object.fromEntries(formData);
        const validatedFields = validateWithZodSchema(reviewSchema, rawData);

        await db.review.create({
            data: {
                ...validatedFields,
                clerkId: user.id,
            },
        });
        revalidatePath(`/products/${validatedFields.productId}`);
        return { message: "Review submitted successfully" };
    } catch (error) {
        return renderError(error);
    }
};

export const fetchProductReviews = async (productId: string) => {
    const reviews = await db.review.findMany({
        where: {
            productId,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    return reviews;
};
export const fetchProductReviewsByUser = async () => {
    const user = await getAuthUser();
    const reviews = await db.review.findMany({
        where: {
            clerkId: user.id,
        },
        select: {
            id: true,
            rating: true,
            comment: true,
            product: {
                select: {
                    image: true,
                    name: true,
                },
            },
        },
    });

    return reviews;
};
export const findExistingReview = async (userId: string, productId: string) => {
    return await db.review.findFirst({
        where: {
            clerkId: userId,
            productId,
        },
    });
};

export const fetchProductRating = async (productId: string) => {
    const results = await db.review.groupBy({
        by: ["productId"],
        _avg: {
            rating: true,
        },
        _count: {
            rating: true,
        },
        where: {
            productId,
        },
    });
    return {
        rating: results[0]?._avg.rating?.toFixed(1) ?? 0,
        count: results[0]?._count.rating ?? 0,
    };
};

export const deleteReviewAction = async (prevState: { reviewId: string }) => {
    const { reviewId } = prevState;
    const user = await getAuthUser();
    try {
        await db.review.delete({
            where: {
                id: reviewId,
                clerkId: user.id,
            },
        });
        revalidatePath(`/reviews`);
    } catch (error) {
        return renderError(error);
    }
    return { message: "Review deleted successfully" };
};

// ### FetchCartItems
export const fetchCartItems = async () => {
    const user = await getAuthUser();

    const cart = await db.cart.findFirst({
        where: {
            clerkId: user.id ?? "",
        },
        select: {
            numItemsInCart: true,
        },
    });
    return cart?.numItemsInCart || 0;
};

const fetchProduct = async (productId: string) => {
    const product = await db.product.findUnique({
        where: {
            id: productId,
        },
    });
    if (!product) {
        throw new Error("Product not found");
    }
    return product;
};

const includeProductClause = {
    cartItems: {
        include: {
            product: true,
        },
    },
};

export const fetchOrCreateCart = async ({
    userId,
    errorOnFailure = false,
}: {
    userId: string;
    errorOnFailure?: boolean;
}) => {
    let cart = await db.cart.findFirst({
        where: {
            clerkId: userId,
        },
        include: includeProductClause,
    });
    if (!cart && errorOnFailure) {
        throw new Error("Cart not found");
    }
    if (!cart) {
        cart = await db.cart.create({
            data: { clerkId: userId },
            include: includeProductClause,
        });
    }
    return cart;
};

const updateOrCreateCartItem = async ({
    productId,
    cartId,
    amount,
}: {
    productId: string;
    cartId: string;
    amount: number;
}) => {
    let cartItem = await db.cartItem.findFirst({
        where: {
            productId,
            cartId,
        },
    });

    if (cartItem) {
        cartItem = await db.cartItem.update({
            where: {
                id: cartItem.id,
            },
            data: {
                amount: cartItem.amount + amount,
            },
        });
    } else {
        cartItem = await db.cartItem.create({
            data: {
                amount,
                productId,
                cartId,
            },
        });
    }
};
export const updateCart = async (cart: Cart) => {
    const cartItems = await db.cartItem.findMany({
        where: {
            cartId: cart.id,
        },
        include: {
            product: true,
        },
    });

    let numItemsInCart = 0;
    let cartTotal = 0;

    for (const item of cartItems) {
        numItemsInCart += item.amount;
        cartTotal += item.amount * item.product.price;
    }
    const tax = cart.taxRate * cartTotal;
    const shipping = cartTotal ? cart.shipping : 0;
    const orderTotal = cartTotal + tax + shipping;

    await db.cart.update({
        where: {
            id: cart.id,
        },
        data: {
            numItemsInCart,
            cartTotal,
            tax,
            orderTotal,
        },
    });
};
export const addToCartAction = async (prevState: any, formData: FormData) => {
    const user = await getAuthUser();
    try {
        const productId = formData.get("productId") as string;
        const amount = Number(formData.get("amount"));
        await fetchProduct(productId);
        const cart = await fetchOrCreateCart({ userId: user.id });
        await updateOrCreateCartItem({ productId, cartId: cart.id, amount });
        await updateCart(cart);
        revalidatePath(`/products/${productId}`);
        return { message: "Product added to cart" };
    } catch (error) {
        return renderError(error);
    }
};
export const removeCartItemAction = async () => {};
export const updateCartItemAction = async () => {};
