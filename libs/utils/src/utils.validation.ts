import Ajv from 'ajv'
import addFormats from "ajv-formats"
import { ValidationError } from './utils.errors'
// import { IFileValidatorOptions } from './files'

const ajv = new Ajv()
addFormats(ajv)
const UserSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string', pattern: '^\\+\\d{1,3}\\d{7,14}$' },
    password: {
      type: 'string',
      minLength: 6,
      // pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{6,}$' // At least one letter and one number
    }
  },
  required: ['firstName', 'lastName', 'email', 'phone', 'password'],
  additionalProperties: false
}
const UserUpdateSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    // email: { type: 'string', format: 'email' },
    phone: { type: 'string', pattern: '^\\+\\d{1,3}\\d{7,14}$' },
  },
  additionalProperties: false
}
// Schema for IOwnershipStructure
export function validateUser(user: any, initial = true) {
  const schema = initial ? UserSchema : UserUpdateSchema
  const validate = ajv.compile(schema)
  const valid = validate(user)
  if (!valid) {
    // @ts-expect-error
    throw new ValidationError(validate.errors?.[0].message)
  }
  return true
}

export function validatePhone(phone: string) {
  const phoneRegex = /^\+\d{1,3}\d{7,14}$/;
  return phoneRegex.test(phone);
}

// export async function validateFile(file: any, options: IFileValidatorOptions): Promise<void> {
//   const { maxSize, allowedTypes } = options;
//   if (file.size > maxSize) {
//     throw new ValidationError(`File size exceeds the allowed limit of ${maxSize} bytes`);
//   }
//   if (!allowedTypes.includes(file.mimetype)) {
//     throw new ValidationError(`File type '${file.mimetype}' is not allowed`);
//   }
// }
// export async function getFileValidatorOptions(file: any) {
//   const fileType = file.mimetype;
//   const validatorOptions = {
//     'application/pdf': {
//       maxSize: 20 * 1024 * 1024, // 20MB
//       allowedTypes: ["application/pdf"]
//     },
//     'image': {
//       maxSize: 10 * 1024 * 1024, // 10MB
//       allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"]
//     },
//     'video': {
//       maxSize: 50 * 1024 * 1024, // 50MB
//       allowedTypes: ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/avi"]
//     }
//   };

//   switch (true) {
//     case fileType.startsWith('image/'):
//       return validatorOptions['image'];
//     case fileType.startsWith('video/'):
//       return validatorOptions['video'];
//     case fileType === 'application/pdf':
//       return validatorOptions['application/pdf'];
//     default:
//       throw new ValidationError(`Unsupported file type`);
//   }
//  }
export function validateGeneral(data: any, schema: object) {
  const validate = ajv.compile(schema)
  const valid = validate(data)
  if (!valid) {
    console.log("Error", validate.errors)
    throw new ValidationError((validate.errors?.[0].message) as string)
  }
}