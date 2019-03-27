/**
 * Search GIFs by a string and rating
 * @param {string} query Search query term or phrase
 * @param {string} rating limit results to those rated (y,g, pg, pg-13 or r)
 * @returns {array} gifs The array of GIF objects
 * @ {object} gif
 * @   {object} images
 * @   {?object} user
 * @   {string} url
 */
module.exports = async (query, rating = null, context) => {
  return [
    {
      type: 'gif',
      id: 'F3gda5icxL73i',
      slug: 'steve-statements-bisciotti-F3gda5icxL73i',
      url: 'https://giphy.com/gifs/steve-statements-bisciotti-F3gda5icxL73i',
      bitly_gif_url: 'https://gph.is/1UmeYf3',
      bitly_url: 'https://gph.is/1UmeYf3',
      embed_url: 'https://giphy.com/embed/F3gda5icxL73i',
      source:
        'https://www.eonline.com/news/581612/the-7-most-cringe-inducing-statements-from-baltimore-ravens-owner-steve-bisciotti',
      rating: 'g',
      content_url: null,
      tags: null,
      featured_tags: null,
      user: null,
      images: {
        media_id: 'F3gda5icxL73i',
        preview_gif: {
          media_id: 'F3gda5icxL73i',
          rendition_type: 'preview_gif',
          url: 'https://media0.giphy.com/media/F3gda5icxL73i/giphy-preview.gif',
          width: '190',
          height: '82',
          size: '49486',
          frames: null,
          mp4: null,
          mp4_size: null,
          webp: null,
          webp_size: null
        }
      },
      source_tld: 'www.eonline.com',
      source_post_url: null,
      update_datetime: null,
      create_datetime: null,
      import_datetime: '2015-08-05T02:59:29.000Z',
      trending_datetime: null,
      title: 'steve GIF'
    }
  ];
};
