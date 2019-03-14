/**
 * Retrieves Customer details by id
 * @param {string} id
 * @returns {object} customer The Customer data
 * @ {string} id
 * @ {string} object
 * @ {number} account_balance
 * @ {number} created
 * @ {boolean} delinquent
 * @ {string} email
 * @ {string} invoice_prefix
 * @ {boolean} livemode
 * @ {object} sources
 * @   {string} object
 * @   {array} data
 * @   {boolean} has_more
 * @   {number} total_count
 * @   {string} url
 * @ {object} subscriptions
 * @   {string} object
 * @   {array} data
 * @   {boolean} has_more
 * @   {number} total_count
 * @   {string} url
 */
module.exports = async (id, context) => {
  return {
    id: 'cus_EEFPdddddCjZ1dM',
    object: 'customer',
    account_balance: 0,
    created: 1545871187,
    currency: null,
    default_source: null,
    delinquent: false,
    description: 'test',
    discount: null,
    email: 'an@email.com',
    invoice_prefix: '535D7D1',
    livemode: false,
    metadata: {},
    shipping: null,
    sources: {
      object: 'list',
      data: [],
      has_more: false,
      total_count: 0,
      url: '/v1/customers/cus_EEFPmasaaasdfd1dM/sources'
    },
    subscriptions: {
      object: 'list',
      data: [],
      has_more: false,
      total_count: 0,
      url: '/v1/customers/cus_EEFPmsdfsdfFCjZ1dM/subscriptions'
    },
    tax_info: null,
    tax_info_verification: null
  };
};
