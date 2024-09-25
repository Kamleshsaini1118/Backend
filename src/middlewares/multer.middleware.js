import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname) // bad approce because same name ki file bhut sare aa shekte h to usse file duplicate ho jayge
    }
  })
  
export  const upload = multer({ storage })

