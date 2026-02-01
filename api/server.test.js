const request = require('supertest');
const { app, pool, validarCPF, validarMacAddress } = require('./server');

// Mock the pg Pool
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mockPool) };
});

describe('Validation Functions', () => {
  describe('validarCPF', () => {
    test('should return true for valid CPF with 11 digits', () => {
      expect(validarCPF('12345678901')).toBe(true);
    });

    test('should return true for CPF with formatting (dots and dash)', () => {
      expect(validarCPF('123.456.789-01')).toBe(true);
    });

    test('should return true for CPF with spaces', () => {
      expect(validarCPF('123 456 789 01')).toBe(true);
    });

    test('should return false for CPF with less than 11 digits', () => {
      expect(validarCPF('1234567890')).toBe(false);
    });

    test('should return false for CPF with more than 11 digits', () => {
      expect(validarCPF('123456789012')).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(validarCPF('')).toBe(false);
    });

    test('should return false for string with only non-digit characters', () => {
      expect(validarCPF('abc.def.ghi-jk')).toBe(false);
    });

    test('should handle CPF with mixed characters', () => {
      expect(validarCPF('abc12345678901xyz')).toBe(true);
    });
  });

  describe('validarMacAddress', () => {
    test('should return true for valid MAC with colons (uppercase)', () => {
      expect(validarMacAddress('AA:BB:CC:DD:EE:FF')).toBe(true);
    });

    test('should return true for valid MAC with colons (lowercase)', () => {
      expect(validarMacAddress('aa:bb:cc:dd:ee:ff')).toBe(true);
    });

    test('should return true for valid MAC with colons (mixed case)', () => {
      expect(validarMacAddress('Aa:Bb:Cc:Dd:Ee:Ff')).toBe(true);
    });

    test('should return true for valid MAC with hyphens', () => {
      expect(validarMacAddress('AA-BB-CC-DD-EE-FF')).toBe(true);
    });

    test('should return true for valid MAC with numbers', () => {
      expect(validarMacAddress('00:11:22:33:44:55')).toBe(true);
    });

    test('should return false for MAC without separators', () => {
      expect(validarMacAddress('AABBCCDDEEFF')).toBe(false);
    });

    test('should return true for MAC with mixed separators (regex allows both)', () => {
      // The current regex allows mixing : and - separators
      expect(validarMacAddress('AA:BB-CC:DD-EE:FF')).toBe(true);
    });

    test('should return false for MAC with invalid characters', () => {
      expect(validarMacAddress('GG:HH:II:JJ:KK:LL')).toBe(false);
    });

    test('should return false for MAC with wrong segment count', () => {
      expect(validarMacAddress('AA:BB:CC:DD:EE')).toBe(false);
    });

    test('should return false for MAC with wrong segment length', () => {
      expect(validarMacAddress('A:BB:CC:DD:EE:FF')).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(validarMacAddress('')).toBe(false);
    });

    test('should return false for null-like inputs', () => {
      expect(validarMacAddress('null')).toBe(false);
    });
  });
});

describe('API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /health', () => {
    test('should return ok status when database is connected', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        database: 'connected',
      });
    });

    test('should return error status when database is disconnected', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        status: 'error',
        database: 'disconnected',
      });
    });
  });

  describe('POST /logs', () => {
    const validLogData = {
      cpf: '12345678901',
      macaddress: 'AA:BB:CC:DD:EE:FF',
    };

    test('should create a log entry successfully', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          cpf: '12345678901',
          mac_address: 'AA:BB:CC:DD:EE:FF',
          horario: '2026-02-01T10:00:00.000Z',
        }],
      };
      pool.query.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/logs')
        .send(validLogData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Log registrado com sucesso');
      expect(response.body.data).toEqual(mockResult.rows[0]);
    });

    test('should return 400 when cpf is missing', async () => {
      const response = await request(app)
        .post('/logs')
        .send({ macaddress: 'AA:BB:CC:DD:EE:FF' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Campos obrigatórios: cpf, macaddress');
    });

    test('should return 400 when macaddress is missing', async () => {
      const response = await request(app)
        .post('/logs')
        .send({ cpf: '12345678901' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Campos obrigatórios: cpf, macaddress');
    });

    test('should return 400 when both fields are missing', async () => {
      const response = await request(app)
        .post('/logs')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Campos obrigatórios: cpf, macaddress');
    });

    test('should return 400 for invalid CPF format', async () => {
      const response = await request(app)
        .post('/logs')
        .send({ cpf: '123456789', macaddress: 'AA:BB:CC:DD:EE:FF' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('CPF inválido. Deve conter 11 dígitos.');
    });

    test('should return 400 for invalid MAC address format', async () => {
      const response = await request(app)
        .post('/logs')
        .send({ cpf: '12345678901', macaddress: 'invalid-mac' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('MAC Address inválido. Formato esperado: XX:XX:XX:XX:XX:XX');
    });

    test('should convert MAC address to uppercase', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          cpf: '12345678901',
          mac_address: 'AA:BB:CC:DD:EE:FF',
          horario: '2026-02-01T10:00:00.000Z',
        }],
      };
      pool.query.mockResolvedValueOnce(mockResult);

      await request(app)
        .post('/logs')
        .send({ cpf: '12345678901', macaddress: 'aa:bb:cc:dd:ee:ff' });

      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO logs (cpf, mac_address, horario) VALUES ($1, $2, NOW()) RETURNING *',
        ['12345678901', 'AA:BB:CC:DD:EE:FF']
      );
    });

    test('should return 500 on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/logs')
        .send(validLogData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  describe('GET /logs', () => {
    test('should return paginated logs with default pagination', async () => {
      const mockLogs = {
        rows: [
          { id: 1, cpf: '12345678901', mac_address: 'AA:BB:CC:DD:EE:FF', horario: '2026-02-01T10:00:00.000Z' },
          { id: 2, cpf: '98765432101', mac_address: '11:22:33:44:55:66', horario: '2026-02-01T09:00:00.000Z' },
        ],
      };
      const mockCount = { rows: [{ count: '100' }] };

      pool.query
        .mockResolvedValueOnce(mockLogs)
        .mockResolvedValueOnce(mockCount);

      const response = await request(app).get('/logs');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockLogs.rows);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 100,
        totalPages: 2,
      });
    });

    test('should return paginated logs with custom pagination', async () => {
      const mockLogs = { rows: [] };
      const mockCount = { rows: [{ count: '100' }] };

      pool.query
        .mockResolvedValueOnce(mockLogs)
        .mockResolvedValueOnce(mockCount);

      const response = await request(app).get('/logs?page=2&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 100,
        totalPages: 10,
      });

      // Verify correct offset calculation
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM logs ORDER BY horario DESC LIMIT $1 OFFSET $2',
        [10, 10]
      );
    });

    test('should handle empty results', async () => {
      const mockLogs = { rows: [] };
      const mockCount = { rows: [{ count: '0' }] };

      pool.query
        .mockResolvedValueOnce(mockLogs)
        .mockResolvedValueOnce(mockCount);

      const response = await request(app).get('/logs');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.pagination.totalPages).toBe(0);
    });

    test('should return 500 on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/logs');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  describe('GET /logs/stats', () => {
    test('should return statistics successfully', async () => {
      const mockStats = {
        rows: [{
          total_logs: '150',
          cpfs_unicos: '50',
          macs_unicos: '75',
          primeiro_registro: '2026-01-01T00:00:00.000Z',
          ultimo_registro: '2026-02-01T10:00:00.000Z',
        }],
      };
      const mockLast24h = { rows: [{ count: '25' }] };

      pool.query
        .mockResolvedValueOnce(mockStats)
        .mockResolvedValueOnce(mockLast24h);

      const response = await request(app).get('/logs/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        total_logs: '150',
        cpfs_unicos: '50',
        macs_unicos: '75',
        primeiro_registro: '2026-01-01T00:00:00.000Z',
        ultimo_registro: '2026-02-01T10:00:00.000Z',
        logs_ultimas_24h: 25,
      });
    });

    test('should handle empty database statistics', async () => {
      const mockStats = {
        rows: [{
          total_logs: '0',
          cpfs_unicos: '0',
          macs_unicos: '0',
          primeiro_registro: null,
          ultimo_registro: null,
        }],
      };
      const mockLast24h = { rows: [{ count: '0' }] };

      pool.query
        .mockResolvedValueOnce(mockStats)
        .mockResolvedValueOnce(mockLast24h);

      const response = await request(app).get('/logs/stats');

      expect(response.status).toBe(200);
      expect(response.body.total_logs).toBe('0');
      expect(response.body.logs_ultimas_24h).toBe(0);
    });

    test('should return 500 on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/logs/stats');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  describe('GET /logs/search', () => {
    test('should search by CPF successfully', async () => {
      const mockResult = {
        rows: [
          { id: 1, cpf: '12345678901', mac_address: 'AA:BB:CC:DD:EE:FF', horario: '2026-02-01T10:00:00.000Z' },
        ],
      };
      pool.query.mockResolvedValueOnce(mockResult);

      const response = await request(app).get('/logs/search?cpf=12345678901');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult.rows);
      expect(response.body.count).toBe(1);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('cpf LIKE'),
        ['%12345678901%']
      );
    });

    test('should search by MAC successfully', async () => {
      const mockResult = {
        rows: [
          { id: 1, cpf: '12345678901', mac_address: 'AA:BB:CC:DD:EE:FF', horario: '2026-02-01T10:00:00.000Z' },
        ],
      };
      pool.query.mockResolvedValueOnce(mockResult);

      const response = await request(app).get('/logs/search?mac=AA:BB:CC');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResult.rows);
      expect(response.body.count).toBe(1);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('mac_address LIKE'),
        ['%AA:BB:CC%']
      );
    });

    test('should search by both CPF and MAC', async () => {
      const mockResult = { rows: [] };
      pool.query.mockResolvedValueOnce(mockResult);

      const response = await request(app).get('/logs/search?cpf=123&mac=AA:BB');

      expect(response.status).toBe(200);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('cpf LIKE'),
        ['%123%', '%AA:BB%']
      );
    });

    test('should convert MAC search to uppercase', async () => {
      const mockResult = { rows: [] };
      pool.query.mockResolvedValueOnce(mockResult);

      await request(app).get('/logs/search?mac=aa:bb:cc');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('mac_address LIKE'),
        ['%AA:BB:CC%']
      );
    });

    test('should return 400 when no search parameters provided', async () => {
      const response = await request(app).get('/logs/search');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Informe pelo menos um parâmetro: cpf ou mac');
    });

    test('should handle no results found', async () => {
      const mockResult = { rows: [] };
      pool.query.mockResolvedValueOnce(mockResult);

      const response = await request(app).get('/logs/search?cpf=nonexistent');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    test('should return 500 on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/logs/search?cpf=123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });
});
