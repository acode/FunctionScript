/**
 * Test mismatch
 * @returns {object}
 * @ {object} user
 * @   {array} posts
 * @     {object} post
 * @       {string} title
 * @       {array} messages
 * @         {string}
 */
module.exports = async () => {
  return {
    user: {
      posts: [
        {
          title: 'sup',
          messages: ['hey', 'there', 7]
        }
      ]
    }
  };
};
