"use server";
import { redirect } from "next/navigation";
import db from "./db";
import { auth, currentUser } from "@clerk/nextjs/server";
import { imageSchema, productSchema, validateWithZodSchema } from "./schemas";

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
    if (!product) redirect("/");
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

        await db.product.create({
            data: {
                ...validatedFields,
                image: "validateFile.image",
                clerkId: user.id,
            },
        });
        return { message: "Product created" };
    } catch (error) {
        return renderError(error);
    }
};
