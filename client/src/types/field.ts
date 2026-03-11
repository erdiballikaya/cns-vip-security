export type FieldType = "text" | "number" | "boolean" | "select" | "image" | "matrix" | "date";
export type Option = { label: string; value: string };
export type MatrixColumn = { key: string; label: string; subLabel?: string; cellType?: "boolean" | "text" };
export type MatrixRow = { key: string; label: string };
export type MatrixColumnMode = "manual" | "personnel";
export type MatrixCellType = "boolean" | "text";

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
  columnMode?: MatrixColumnMode;
  cellType?: MatrixCellType;
  columns?: MatrixColumn[];
  rows?: MatrixRow[];
};
