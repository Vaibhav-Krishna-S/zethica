// tests/test-utils.js
// Mock utilities for testing chat API

export class MockClient {
  constructor(options = {}) {
    this.connected = false;
    this.shouldFail = options.shouldFail || false;
    this.queryResults = options.queryResults || [];
  }

  async connect() {
    if (this.shouldFail) {
      throw new Error('Connection failed');
    }
    this.connected = true;
  }

  async query(sql, params) {
    if (this.shouldFail) {
      throw new Error('Query failed');
    }
    return { rows: this.queryResults };
  }

  async end() {
    this.connected = false;
  }
}

export class MockRequest {
  constructor(options = {}) {
    this.method = options.method || 'POST';
    this.body = options.body || {};
    this.headers = options.headers || {};
    this.connection = options.connection || { remoteAddress: '127.0.0.1' };
  }
}

export class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = null;
    this.ended = false;
  }

  setHeader(key, value) {
    this.headers[key] = value;
    return this;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(data) {
    this.body = data;
    this.ended = true;
    return this;
  }

  end() {
    this.ended = true;
    return this;
  }
}

export function mockFetch(options = {}) {
  const { shouldFail = false, status = 200, data = {} } = options;

  return async (url, config) => {
    if (shouldFail) {
      throw new Error('Fetch failed');
    }

    if (status !== 200) {
      return {
        ok: false,
        status,
        text: async () => JSON.stringify({ error: 'API error' })
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => data
    };
  };
}

export const sampleChunks = [
  {
    chunk_id: 'abc123',
    source_file: 'SERVICES.md',
    section_heading: 'Logo and Brand Identity',
    subsection_heading: null,
    chunk_content: 'ZETHICA offers custom logo design, brand guidelines, and color systems.'
  },
  {
    chunk_id: 'def456',
    source_file: 'SERVICES.md',
    section_heading: 'Website Development',
    subsection_heading: null,
    chunk_content: 'We build fast, responsive, conversion-optimized websites.'
  }
];

export const systemPrompt = `You are the ZETHICA customer support AI assistant.
Answer questions accurately based on retrieved knowledge.
If the knowledge base does not contain the answer, say you need human confirmation.
Do not invent business facts, prices, or guarantees.`;
