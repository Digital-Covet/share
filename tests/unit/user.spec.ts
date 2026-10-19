import { test } from '@japa/runner'
import User from '#models/user'

function makeUser(email: string, name: string | null) {
  const user = new User()
  user.email = email
  user.name = name
  return user
}

test.group('User#initials', () => {
  test('uses the first letters of a two-word name', ({ assert }) => {
    assert.equal(makeUser('ada@example.com', 'Ada Lovelace').initials, 'AL')
  })

  test('uses the first two letters of a single name', ({ assert }) => {
    assert.equal(makeUser('plato@example.com', 'plato').initials, 'PL')
  })

  test('falls back to the email local part when name is missing', ({ assert }) => {
    assert.equal(makeUser('grace.hopper@example.com', null).initials, 'GH')
    assert.equal(makeUser('linus@example.com', '   ').initials, 'LI')
  })
})
