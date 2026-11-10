import { neon } from '@neondatabase/serverless'

// Tagged-template SQL client: sql`select * from users where id = ${id}`
// Created on first use so a missing DATABASE_URL fails the request, not the import.
let client

export function sql(strings, ...values) {
  if (!client) {
    client = neon(process.env.DATABASE_URL)
  }
  return client(strings, ...values)
}
