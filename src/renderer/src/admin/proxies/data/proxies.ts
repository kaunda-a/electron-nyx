import { faker } from '@faker-js/faker'

export const proxies = Array.from({ length: 20 }, () => ({
  id: faker.string.uuid(),
  name: faker.internet.domainWord(),
  host: faker.internet.ip(),
  port: faker.number.int({ min: 1000, max: 65535 }),
  protocol: faker.helpers.arrayElement(['http', 'https', 'socks4', 'socks5']),
  username: faker.internet.userName(),
  password: faker.internet.password(),
  status: faker.helpers.arrayElement(['active', 'inactive']),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
}))
