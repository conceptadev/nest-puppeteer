import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from "class-validator";

/**
 * Validates that either `url` or `html` is provided (at least one must be a non-empty string).
 *
 * Apply to the `url` property. The validator inspects the full object.
 * Uses `always: true` so it runs even when the property is absent/undefined.
 */
export function IsUrlOrHtml(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isUrlOrHtml",
      target: object.constructor,
      propertyName,
      options: {
        message: 'Either "url" or "html" must be provided',
        ...validationOptions,
      },
      constraints: [],
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          return typeof obj.url === "string" || typeof obj.html === "string";
        },
      },
    });
  };
}
