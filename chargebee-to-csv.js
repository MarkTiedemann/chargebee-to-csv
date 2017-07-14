#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const minimist = require('minimist')
const fetch = require('node-fetch')
const csv = require('json2csv')

const limit = 100
const resultSet = new Set()
const offsetList = []
const flags = minimist(process.argv.slice(2))

doFetch(flags)

function doFetch ({ url, token, file, next_offset }) {
  // See: https://apidocs.chargebee.com/docs/api/#pagination_and_filtering

  // first call has no offset
  const offset = next_offset
    ? `&offset=${next_offset}`
    : ''

  fetch(`${url}?limit=${limit}${offset}`, addAuth(token))
  .then(res => res.status !== 200
    ? Promise.reject(new Error(res.status))
    : res.json())
  .then(body => {
    
    // add the results to the result set
    body.list.forEach(result => resultSet.add(result))

    const offset = body.next_offset
    // the offset is circular: so if the offset is already in the list
    // we don't need to fetch anymore data
    const hasMore = offset && !offsetList.includes(offset)
    if (hasMore) {
      offsetList.push(offset)
      doFetch({ url, token, file, next_offset: offset })
    } else {
      // no more data needs to be fetched, write the result set to the csv file
      const data = csv({ data: Array.from(resultSet), flatten: true })
      fs.writeFile(file, data, err => {
        if (err) throw err
      })
    }
  })
  .catch(err => {
    console.error('An unexpected error occured:', err)
    process.exit(1)
  })
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
