export type FieldType = "text" | "number" | "boolean" | "select" | "image";
export type Option = { label: string; value: string };

export type FieldDto = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number;
  options?: Option[];
  defaultValue?: any;
  order?: number; // var ama UI'da yönetmiyoruz
};