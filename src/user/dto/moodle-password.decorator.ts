import { ValidateBy, type ValidationOptions } from 'class-validator';

const MOODLE_PASSWORD_MESSAGE =
  'A senha deve ter pelo menos 8 caracteres, incluindo uma letra maiuscula, uma letra minuscula, um numero e um caractere especial.';

export function IsMoodlePassword(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isMoodlePassword',
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return false;
          }

          return (
            value.length >= 8 &&
            /[a-z]/.test(value) &&
            /[A-Z]/.test(value) &&
            /\d/.test(value) &&
            /[^A-Za-z0-9]/.test(value)
          );
        },
        defaultMessage(): string {
          return MOODLE_PASSWORD_MESSAGE;
        },
      },
    },
    validationOptions,
  );
}
