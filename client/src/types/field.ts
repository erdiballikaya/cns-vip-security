export type FieldType = "text" | "number" | "boolean" | "select" | "image" | "matrix";
export type Option = { label: string; value: string };
export type MatrixColumn = { key: string; label: string; subLabel?: string };
export type MatrixRow = { key: string; label: string };

export type FieldDto = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number;
  options?: Option[];
  defaultValue?: any;
  order?: number;

  // ✅ matrix için
  columns?: MatrixColumn[];
  rows?: MatrixRow[];
};
