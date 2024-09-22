import { apiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";

// create method
const registerUser = asyncHandler( async (req, res) => {
    // get user detail from frontend 
    // validation -  not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create the object = create entry in DB
    // remove the password and refresh token field from      response
    // check for user creation 
    // return response


    // step-1: Get user detail from frontend and d-structure the data
    const {username, fullName, email, password} = req.body
    console.log("email: ", email);

    // step-2 Validation

    // method-1 for beginner
    
    /* if(fullName === ""){
        throw new apiError(400, "fullname required")
    } */

    // method-2
    if(
        [username, fullName, email, password].some((field) => 
        field?.trim() === "")
    ){
        throw new apiError(400, "All fields are required")
    }

    // step-3 Check user already exists or not !
    const existedUSer = User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUSer){
        throw new apiError(409, "User with email or username already exists")
    }

    // step-4 Check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path; 
    // ye file abhi local server pr h cloudinary pr upload nhi hue h

    if(!avatarLocalPath){
        throw new apiError(400, "avatar file is required")
    }

    // step-5 Upload them to cloudinary, avatar

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    // await ka use krte h kuki file upload hone m time lag shekta h isliye starting me bhi async ka use liya h jisse fast ho 
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new apiError(400, "avatar file is required")
    }

    // step-6 create the object = create entry in DB
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // check kro user bana h y nahi
    if (!createdUser) {
        throw new apiError(500, "Something went wrong while registering the user")
    }

    // step-7 return response
    return res.status(201).json(
        new apiResponse(200, createdUser, "User registered successfully")
    )
}) 

export { registerUser }