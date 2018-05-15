module.exports = {
  version: process.env.VERSION || require('../package').version,
  cdn_http: process.env.CDN_HTTP || 'http://js.eventflit.com',
  cdn_https: process.env.CDN_HTTPS || 'https://js.eventflit.com',
  dependency_suffix: (process.env.MINIFY ? '.min' : '' )
}
