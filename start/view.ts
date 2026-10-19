/*
|--------------------------------------------------------------------------
| Edge globals
|--------------------------------------------------------------------------
|
| Values available to every Edge template.
|
*/

import edge from 'edge.js'
import env from '#start/env'

/**
 * Absolute base URL, for links that must not be relative (Open Graph
 * images in the layout). Trailing slash stripped so templates can append
 * paths.
 */
edge.global('appUrl', env.get('APP_URL').replace(/\/+$/, ''))
