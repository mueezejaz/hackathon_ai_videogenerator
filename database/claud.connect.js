import { v2 as cloudinary } from "cloudinary";
import { config } from '../config/env.js'


cloudinary.config({
  cloud_name: config.get('cloud_name'),
  api_key: config.get('api_key'),
  api_secret: config.get('api_secret'),
});

export default cloudinary;


