import { asyncHandler } from "../utils/asyncHandler.js"

// create method
const registerUser = asyncHandler( async (req, res) => {
    res.status(200).json({
        message: "KK-ENGINEERS"
    })
})

export { registerUser }