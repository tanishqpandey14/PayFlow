export function validatePassword(password) {
  if (typeof password !== "string") {
    return {
      valid: false,
      message: "Password must be a string",
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long",
    };
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return {
      valid: false,
      message: "Password must not exceed 72 bytes",
    };
  }

  return {
    valid: true,
    message: "Password is valid",
  };
}
