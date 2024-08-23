import { auth } from "@clerk/nextjs/server";
import { CardSignInButton } from "../form/Buttons";
import { fetchFavoriteId } from "@/utils/actions";
import FavoriteToggleForm from "./FavoriteToggleForm";
import { Button } from "../ui/button";
import { FaHeart } from "react-icons/fa";
async function FavoriteToggleButton({ productId }: { productId: string }) {
    const { userId } = auth();
    if (!userId) return <CardSignInButton />;
    const favoriteId = await fetchFavoriteId({ productId });

    return <FavoriteToggleForm favoriteId={favoriteId} productId={productId} />;

    // return (
    //     <Button size='icon' variant='outline' className='p-2 cursor-pointer'>
    //         <FaHeart />
    //     </Button>
    // );
}
export default FavoriteToggleButton;
