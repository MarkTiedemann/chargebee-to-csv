#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const minimist = require('minimist')
const fetch = require('node-fetch')
const csv = require('json2csv')

const limit = 100
const resultSet = new Set()
const flags = minimist(process.argv.slice(2))

doFetch(flags)

function doFetch ({ url, token, file, next_offset }) {
  fetch(buildUrl(url, next_offset), addAuth(token))
  .then(checkFetch)
  .then(onFetch({ url, token, file, next_offset }))
  .catch(onError)
}

function buildUrl (url, next_offset) {
  // See: https://apidocs.chargebee.com/docs/api/#pagination_and_filtering
  // first call has no offset
  const offset = next_offset
    ? `&offset=${next_offset}`
    : ''

  return `${url}?limit=${limit}${offset}`
}

function addAuth (token) {
  // See: https://apidocs.chargebee.com/docs/api#api_authentication
  // Chargbee uses basic auth where user name == token and the password is ''
  const basic = Buffer.from(`${token}:`).toString('base64')
  return {
    headers: {
      'Authorization': `Basic ${basic}`
    }
  }
}

function checkFetch (res) {
  return res.status !== 200
    ? Promise.reject(new Error(res.status))
    : res.json()
}

function onFetch ({ url, token, file, next_offset }) {
  return body => {
    // add the results to the result set
    body.list.forEach(result => resultSet.add(result))

    const offset = body.next_offset
    if (offset) {
      doFetch({ url, token, file, next_offset: offset })
    } else {
      writeCsv(resultSet, file)
    }
  }
}

function writeCsv (resultSet, file) {
  const data = csv({ data: Array.from(resultSet), flatten: true })
  fs.writeFile(file, data, err => {
    if (err) throw err
  })
}

function onError (err) {
  console.error('An unexpected error occured:', err)
  process.exit(1)
}