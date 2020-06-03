/**
* Test Optional Nested Enum
* @param {?string} descriptionHtml The description of the product, complete with HTML formatting.
* @param {?array} metafields The metafields to associate with this product.
* @ {object} MetafieldInput Specifies the input fields for a metafield.
* @   {?string} value The value of a metafield.
* @   {?enum} valueType Metafield value types.
*       ["STRING", "STRING"]
*       ["INTEGER", "INTEGER"]
*       ["JSON_STRING", "JSON_STRING"]
* @param {?array} privateMetafields The private metafields to associated with this product.
* @ {object} PrivateMetafieldInput Specifies the input fields for a PrivateMetafield.
* @   {?any} owner The owning resource.
* @   {object} valueInput The value and value type of the metafield, wrapped in a ValueInput object.
* @     {string} value The value of a private metafield.
* @     {enum} valueType Private Metafield value types.
*         ["STRING", "STRING"]
*         ["INTEGER", "INTEGER"]
*         ["JSON_STRING", "JSON_STRING"]
* @param {?array} variants A list of variants associated with the product.
* @ {object} ProductVariantInput Specifies a product variant to create or update.
* @   {?string} barcode The value of the barcode associated with the product.
* @   {?enum} inventoryPolicy The inventory policy for a product variant controls whether customers can continue to buy the variant when it is out of stock. When the value is `continue`, customers are able to buy the variant when it's out of stock. When the value is `deny`, customers can't buy the variant when it's out of stock.
*       ["DENY", "DENY"]
*       ["CONTINUE", "CONTINUE"]
* @   {?array} metafields Additional customizable information about the product variant.
* @     {object} MetafieldInput Specifies the input fields for a metafield.
* @       {?string} description The description of the metafield .
* @       {?enum} valueType Metafield value types.
*           ["STRING", "STRING"]
*           ["INTEGER", "INTEGER"]
*           ["JSON_STRING", "JSON_STRING"]
* @   {?array} privateMetafields The private metafields to associated with this product.
* @     {object} PrivateMetafieldInput Specifies the input fields for a PrivateMetafield.
* @       {?any} owner The owning resource.
* @       {object} valueInput The value and value type of the metafield, wrapped in a ValueInput object.
* @         {string} value The value of a private metafield.
* @         {enum} valueType Private Metafield value types.
*             ["STRING", "STRING"]
*             ["INTEGER", "INTEGER"]
*             ["JSON_STRING", "JSON_STRING"]
* @   {?string} taxCode The tax code associated with the variant.
* @   {?enum} weightUnit Units of measurement for weight.
*       ["KILOGRAMS", "KILOGRAMS"]
*       ["GRAMS", "GRAMS"]
*       ["POUNDS", "POUNDS"]
*       ["OUNCES", "OUNCES"]
* @param {?array} media List of new media to be added to the product.
* @ {object} CreateMediaInput Specifies the input fields required to create a media object.
* @   {string} originalSource The original source of the media object. May be an external URL or signed upload URL.
* @   {enum} mediaContentType The possible content types for a media object.
*       ["VIDEO", "VIDEO"]
*       ["EXTERNAL_VIDEO", "EXTERNAL_VIDEO"]
*       ["MODEL_3D", "MODEL_3D"]
*       ["IMAGE", "IMAGE"]
* @returns {boolean} myBool A boolean value
*/
module.exports = async (descriptionHtml = null, metafields = null, privateMetafields = null, variants = null, media = null, context) => {
  return obj.operator;
};
