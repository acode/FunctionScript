/**
 * @returns {object} enrichment The Enrichment data
 * @ {?object} person
 * @   {?string} id
 * @   {?object} name
 * @     {?string} givenName
 * @     {?string} familyName
 * @     {?string} fullName
 * @   {?string} location
 * @   {?string} timeZone
 * @   {?number} utcOffset
 * @   {?object} geo
 * @     {?string} city
 * @     {?string} state
 * @     {?string} country
 * @     {?float} lng
 * @     {?float} lat
 * @   {?string} bio
 * @   {?string} site
 * @   {?string} avatar
 * @   {?object} employment
 * @     {?string} name
 * @     {?string} title
 * @     {?string} role
 * @     {?string} subRole
 * @     {?string} seniority
 * @     {?string} domain
 * @   {?object} facebook
 * @     {?string} handle
 * @   {?object} github
 * @     {?number} id
 * @     {?string} handle
 * @     {?string} avatar
 * @     {?string} company
 * @     {?string} blog
 * @     {?string} followers
 * @     {?string} following
 * @   {?object} twitter
 * @     {?number} id
 * @     {?string} handle
 * @     {?string} location
 * @     {?number} followers
 * @     {?number} followers
 * @     {?string} site
 * @     {?string} statuses
 * @     {?string} favorites
 * @     {?string} avatar
 * @   {?object} linkedin
 * @     {?string} handle
 * @   {?object} googleplus
 * @     {?string} handle
 * @   {?object} gravatar
 * @     {?string} handle
 * @     {?array} urls
 * @     {?string} avatar
 * @     {?array} avatars
 * @   {?boolean} fuzzy
 * @   {?string} indexAt
 * @ {?object} company
 * @   {?string} id
 * @   {?string} name
 * @   {?string} legalName
 * @   {?string} domain
 * @   {?array} domainAliases
 * @   {?object} site
 * @     {?array} phoneNumbers
 * @     {?array} emailAddresses
 * @   {?array} tags
 * @   {?object} category
 * @     {?string} sector
 * @     {?string} industryGroup
 * @     {?string} industry
 * @     {?string} subIndustry
 * @     {?string} sicCode
 * @     {?string} naicsCode
 * @   {?string} description
 * @   {?number} foundedYear
 * @   {?string} location
 * @   {?string} timeZone
 * @   {?number} utcOffset
 * @   {?object} geo
 * @     {?string} streetNumber
 * @     {?string} streetName
 * @     {?string} subPremise
 * @     {?string} city
 * @     {?string} state
 * @     {?string} stateCode
 * @     {?string} postalCode
 * @     {?string} country
 * @     {?string} countryCode
 * @     {?number} lat
 * @     {?number} lng
 * @   {?object} identifiers
 * @     {?string} usEIN
 * @   {?object} metrics
 * @     {?number} rasied
 * @     {?number} alexaUsRank
 * @     {?number} alexaGlobalRank
 * @     {?number} employees
 * @     {?string} employeesRange
 * @     {?number} marketCap
 * @     {?number} annualRevenue
 * @     {?string} estimatedAnnualRevenue
 * @     {?number} fiscalYearEnd
 * @   {?object} facebook
 * @     {?string} handle
 * @   {?object} twitter
 * @     {?string} id
 * @     {?string} handle
 * @     {?string} location
 * @     {?number} followers
 * @     {?number} following
 * @     {?string} site
 * @     {?string} statuses
 * @     {?string} favorites
 * @     {?string} avatar
 * @   {?object} linkedin
 * @     {?string} handle
 * @   {?object} crunchbase
 * @     {?string} handle
 * @   {?string} logo
 * @   {?string} type
 * @   {?string} phone
 * @   {?array} tech
 * @   {?object} parent
 */
module.exports = async () => {
  return {
    person: {
      id: '30b42ed8-0bde-4b89-8ef3-d0d3d08af89f',
      name: {
        fullName: 'Steve Meyer',
        givenName: 'Steve',
        familyName: 'Meyer'
      },
      email: 'steve@stdlib.com',
      location: null,
      timeZone: null,
      utcOffset: null,
      geo: {
        city: null,
        state: null,
        stateCode: null,
        country: null,
        countryCode: null,
        lat: null,
        lng: null
      },
      bio: null,
      site: null,
      avatar: null,
      employment: {
        domain: 'stdlib.com',
        name: 'StdLib',
        title: null,
        role: null,
        subRole: null,
        seniority: null
      },
      facebook: { handle: null },
      github: {
        handle: null,
        id: null,
        avatar: null,
        company: null,
        blog: null,
        followers: null,
        following: null
      },
      twitter: {
        handle: null,
        id: null,
        bio: null,
        followers: null,
        following: null,
        statuses: null,
        favorites: null,
        location: null,
        site: null,
        avatar: null
      },
      linkedin: { handle: null },
      googleplus: { handle: null },
      gravatar: { handle: null, urls: null, avatar: null, avatars: [] },
      fuzzy: false,
      emailProvider: false,
      indexedAt: '2019-02-27T10:43:02.308Z'
    },
    company: {
      id: 'e7687ca2-ecd4-491f-8d64-5e304026906c',
      name: 'StdLib',
      legalName: null,
      domain: 'stdlib.com',
      domainAliases: ['code.xyz', 'standardlibrary.com'],
      site: {
        phoneNumbers: ['+1 415-650-1337', '+1 800-778-7879', '+1 800-952-5210'],
        emailAddresses: []
      },
      category: {
        sector: 'Information Technology',
        industryGroup: 'Software & Services',
        industry: 'Internet Software & Services',
        subIndustry: 'Internet Software & Services',
        sicCode: '73',
        naicsCode: '54'
      },
      tags: ['Technology', 'Information Technology & Services', 'SAAS', 'B2B'],
      description:
        'Build the business-critical integrations and APIs you want in minutes instead of days. Intelligent enough for you, powerful enough for your engineering team. Join tens of thousands building on Standard Library today.',
      foundedYear: null,
      location: '2390 30th Ave, San Francisco, CA 94116, USA',
      timeZone: 'America/Los_Angeles',
      utcOffset: -7,
      geo: {
        streetNumber: '2390',
        streetName: '30th Avenue',
        subPremise: null,
        city: 'San Francisco',
        postalCode: '94116',
        state: 'California',
        stateCode: 'CA',
        country: 'United States',
        countryCode: 'US',
        lat: 37.7427673,
        lng: -122.4873437
      },
      logo: 'https://logo.clearbit.com/stdlib.com',
      facebook: { handle: null, likes: null },
      linkedin: { handle: 'company/stdlib' },
      twitter: {
        handle: 'StdLibHQ',
        id: '722579682298880000',
        bio:
          'A Standard Library for the Web. https://t.co/hmBfCldjVS. Join in.',
        followers: 1736,
        following: 55,
        location: 'San Francisco, CA',
        site: 'https://t.co/vMOOVQrzsh',
        avatar:
          'https://pbs.twimg.com/profile_images/1019974946963972096/dMff2KGl_normal.jpg'
      },
      crunchbase: { handle: 'organization/stdlib' },
      emailProvider: false,
      type: 'private',
      ticker: null,
      identifiers: { usEIN: null },
      phone: null,
      metrics: {
        alexaUsRank: 140760,
        alexaGlobalRank: 306578,
        employees: null,
        employeesRange: null,
        marketCap: null,
        raised: 4000000,
        annualRevenue: null,
        estimatedAnnualRevenue: null,
        fiscalYearEnd: null
      },
      indexedAt: '2019-02-24T07:37:43.337Z',
      tech: [
        'google_apps',
        'cloud_flare',
        'stripe',
        'twitter_advertiser',
        'amazon_s3',
        'facebook_advertiser',
        'google_analytics',
        'heroku',
        'facebook_connect',
        'twitter_button',
        'youtube'
      ],
      parent: { domain: null }
    }
  };
};
