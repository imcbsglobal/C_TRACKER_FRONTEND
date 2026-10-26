// Support-side lists. Edit these two arrays to change what shows in the product pickers.

export const PRODUCT_TYPES = [
  { value: "own", label: "Own Product" },
  { value: "custom", label: "Custom Project" },
];

export const PRODUCTS = {
  own: ["Komet Menu", "Komet Collection", "Release Radar", "MagnetPro Fee Payments"],
  custom: ["Custom ERP Build", "Custom Mobile App", "Custom Integration"],
};

// Every product in one list, and the type it belongs to. The type only decides the
// case ID prefix (OP / CP) and is worked out from the product, never picked.
export const ALL_PRODUCTS = [...PRODUCTS.own, ...PRODUCTS.custom];
export const productTypeOf = (name) => (PRODUCTS.custom.includes(name) ? "custom" : "own");