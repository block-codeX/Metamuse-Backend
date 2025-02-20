import * as bcrypt from 'bcryptjs'
import crypto from 'crypto'
/**
 * Encrypts a password using bcrypt.
 *
 * @param {string} password - The password to be encrypted.
 * @param {number} [saltRounds=10] - The number of salt rounds to use for encryption.
 * @returns {string} The encrypted password.
 * @throws {Error} If there is an error while encrypting the password.
 */
export function encryptPassword (password: string, saltRounds = 10) {
  try {
    const salt = bcrypt.genSaltSync(saltRounds)
    return bcrypt.hashSync(password, salt)
  } catch(e) {
    console.error(e)
    throw new Error('Error while encrypting password')
  }
}

/**
 * Verify if a given password matches a given hash.
 *
 * @param {string} password - The password to be verified.
 * @param {string} hash - The hash to compare the password against.
 * @returns {boolean} - True if the password matches the hash, false otherwise.
 */
export function verifyPassword (password: string, hash: string) {
  return bcrypt.compareSync(password, hash)
}

/**
 * Generates a secret string of specified length.
 *
 * @param {number} [length=16] - The length of the secret string.
 * @returns {string} - The generated secret string.
 */
export function generateSecret (length = 16) {
  return crypto.randomBytes(length).toString('hex')
}

export default {
  encryptPassword, verifyPassword, generateSecret
}