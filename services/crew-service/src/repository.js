import { isAvailableOn } from './availability.js';

/**
 * Both repositories expose the same async interface so the HTTP layer can be tested
 * without a database and run against MongoDB in every other environment.
 */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class MongoCrewRepository {
  constructor(db) {
    this.col = db.collection('crew');
  }

  async init() {
    await this.col.createIndex({ department: 1, name: 1 });
    await this.col.createIndex({ email: 1 }, { unique: true });
  }

  async list({ department, q, availableOn, limit, offset }) {
    const filter = {};
    if (department) filter.department = department;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { roles: rx }];
    }
    if (availableOn) {
      filter.unavailable = { $not: { $elemMatch: { from: { $lte: availableOn }, to: { $gte: availableOn } } } };
    }
    const [items, total] = await Promise.all([
      this.col.find(filter).sort({ name: 1 }).skip(offset).limit(limit).toArray(),
      this.col.countDocuments(filter),
    ]);
    return { items: items.map(toMember), total };
  }

  async get(id) {
    return toMember(await this.col.findOne({ _id: id }));
  }

  async getMany(ids) {
    return (await this.col.find({ _id: { $in: ids } }).toArray()).map(toMember);
  }

  async create(member) {
    const id = await this.nextId();
    const doc = { _id: id, ...member, createdAt: new Date(), updatedAt: new Date() };
    await this.col.insertOne(doc);
    return toMember(doc);
  }

  async update(id, patch) {
    const res = await this.col.findOneAndUpdate(
      { _id: id },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return toMember(res);
  }

  async count() {
    return this.col.estimatedDocumentCount();
  }

  async insertMany(members) {
    await this.col.insertMany(members.map(({ id, ...m }) => ({ _id: id, ...m, createdAt: new Date(), updatedAt: new Date() })));
    // Keep generated ids clear of the seeded ones.
    await this.col.db.collection('counters').updateOne(
      { _id: 'crew' }, { $max: { seq: members.length } }, { upsert: true },
    );
  }

  async nextId() {
    const counter = await this.col.db.collection('counters').findOneAndUpdate(
      { _id: 'crew' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return `crew-${String(counter.seq).padStart(3, '0')}`;
  }
}

function toMember(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export class InMemoryCrewRepository {
  constructor(seed = []) {
    this.items = new Map(seed.map((m) => [m.id, structuredClone(m)]));
    this.seq = seed.length;
  }

  async init() {}

  async list({ department, q, availableOn, limit, offset }) {
    const needle = q?.toLowerCase();
    const all = [...this.items.values()]
      .filter((m) => !department || m.department === department)
      .filter((m) => !needle || m.name.toLowerCase().includes(needle)
        || m.roles.some((r) => r.toLowerCase().includes(needle)))
      .filter((m) => !availableOn || isAvailableOn(m, availableOn))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { items: all.slice(offset, offset + limit), total: all.length };
  }

  async get(id) {
    return this.items.get(id) ?? null;
  }

  async getMany(ids) {
    return ids.map((id) => this.items.get(id)).filter(Boolean);
  }

  async create(member) {
    if ([...this.items.values()].some((m) => m.email === member.email)) {
      throw Object.assign(new Error('duplicate email'), { code: 11000 });
    }
    const id = `crew-${String(++this.seq).padStart(3, '0')}`;
    const created = { id, ...member };
    this.items.set(id, created);
    return created;
  }

  async update(id, patch) {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.items.set(id, updated);
    return updated;
  }

  async count() {
    return this.items.size;
  }

  async insertMany(members) {
    members.forEach((m) => this.items.set(m.id, structuredClone(m)));
    this.seq += members.length;
  }
}
