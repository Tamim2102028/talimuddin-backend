import Joi from "joi";

// ১. রেজিস্ট্রেশন স্কিমা
const userRegisterSchema = Joi.object({
  fullName: Joi.string().trim().min(3).max(50).required().messages({
    "string.empty": "Full name is required",
    "string.min": "Full name must be at least 3 characters",
  }),

  phoneNumber: Joi.string()
    .trim()
    .pattern(/^01[3-9]\d{8}$/)
    .required()
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base":
        "Phone number must be a valid Bangladeshi number (e.g., 01712345678)",
    }),

  // পাসওয়ার্ড পলিসি (স্ট্রং)
  password: Joi.string()
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])"))
    .min(8)
    .required()
    .messages({
      "string.pattern.base":
        "Password must contain at least one lowercase, one uppercase letter and one number",
      "string.min": "Password must be at least 8 characters long",
    }),

  userName: Joi.string()
    .trim()
    .min(3)
    .max(30)
    // ✅ NEW: Regular expression to allow only letters, numbers, and underscores
    .pattern(new RegExp("^[a-zA-Z0-9_]+$"))
    .required()
    .messages({
      "string.pattern.base":
        "Username can only contain letters, numbers, and underscores.",
      "string.min": "Username must be at least 3 characters long.",
      "string.empty": "Username is required.",
    }),

  // ✅ Real World Safety: Backend এও Terms Agreement চেক করা
  agreeToTerms: Joi.boolean().valid(true).required().messages({
    "any.only": "You must agree to the terms and conditions.",
    "any.required": "Agreement to terms is required.",
  }),
});

// Onboarding schema removed - no longer needed for Islamic academy platform

export { userRegisterSchema };
