import { apiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"

// method for access and refresh token 
const generateAccessandRefreshToken = async(userId) => {
    try {// first find the user
        const user = await User.findById(userId);
        if (!user) throw new apiError(404, "User not found");

        // generate token
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        console.log("accesstoken: ", accessToken );
        console.log("refreshtoken: ", refreshToken );

        // refresh token to database me kese dale
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })

        // yahan tak aane ka baad access or refresh token dono return bhi krdo 
        return { accessToken, refreshToken }


    } catch (error) {
        throw new apiError(500, "something went wrong while generating access and refresh tokens")
    }
}

// CREATE METHOD
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
    const existedUSer = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUSer){
        throw new apiError(409, "User with email or username already exists")
    }

    // step-4 Check for images, check for avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path; 
    // ye file abhi local server pr h cloudinary pr upload nhi hue h

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new apiError(400, "avatar file is required")
    }

    // step-5 Upload them to cloudinary, avatar

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    // await ka use krte h kuki file upload hone m time lag shekta h isliye starting me bhi async ka use liya h jisse fast ho 
    const coverImage =  await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new apiError(400, "Avatar file is required")
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

// CREATE LOGIN USER
const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // username or email
    // find user
    // password check
    // assign the access token or refresh token
    // send the cookies 
    // send the successful response   


    // step-1: get the user detail for login (req body -> data)
        const { username, email, password } = req.body;
        console.log("email: ", email);
        console.log("username: ", username);
        
    
        // strp-2: condition - login with username or email
        if (!(username || email)) {
            throw new apiError(400, "usernmae or email is required.")
        }

        console.log("email: ", email);
        console.log("username: ", username);
    
        // step-3: find the user (username or email)
        const user =await User.findOne({
            $or: [{ username }, { email }]
        })
        // user.find({username: username})

        console.log("user found: ", user);
    
        // ager username or email dono hi na ho tab throw the error ki user does not exists
        if (!user) {
            throw new apiError(404, "User does not exists.")
        }
    
        // step-4: password check
        const isPasswordValid = await user.isPasswordCorrect(password)
    
        if (!isPasswordValid) {
            throw new apiError(401, "Invalid user credentials.")
        }
    
        // step-5: Assign the access and refresh token 
        const {accessToken, refreshToken} = await generateAccessandRefreshToken(user._id)
    
        const loggedInUser =await User.findById(user._id).select("-password  -refreshToken")
    
        // step-6: send cookies
        const options = {
            httpOnly: true,
            secure: true
        }
    
        // stp-7: return response
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new apiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in Successfully"
            )
        )
})

// CREATE LOGOUT USER
const logoutUser =  asyncHandler(async (req, res) => {
    // clear the cookies
    // reset the access or refresh token 
    // logout ke liye middleware banana padega auth.middleware

   await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "USer logged out"))
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new apiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRRT
        )
    
        const user =  await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new apiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401, "refresh token is expired or used")
        }
    
        // cookies
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessandRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new apiResponse(
                200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token refresed"
            )
        )
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    // ek comfirm password bhi hota h bs newpassword or confirm password ko check krna hota h ki same h ya nahi, ager hain to aage bhad jao nhi ek error throw krdo !
    const { oldPassword, newPassword } = req.body

    // find the user
    const user = await User.findById(req.user?._id)

    // check password correct or not !
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new apiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            {},
            "Password changed successfully."
        )
    )
})

// get current user
const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(200, req.user, "Current user fetched successfully.")
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new apiError(400, "All fields are required.")
    }

    // find the user
    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json( 
        new apiResponse(
            200,
            user,
            "Account details updated successfully"
        )
    )

})

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new apiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new apiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            user,
            "Avatar image updated successfully"
        )

    )
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new apiError(400, "CoverImage file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new apiError(400, "Error while uploading on coverImage")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            user,
            "Cover image updated successfully"
        )

    )
})


export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}