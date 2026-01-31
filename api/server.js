const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuração do pool de conexões PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'loguser',
  password: process.env.DB_PASSWORD || 'logpassword123',
  database: process.env.DB_NAME || 'logdb',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Validação simples de CPF (formato)
function validarCPF(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, '');
  return cpfLimpo.length === 11;
}

// Validação de MAC Address (formato)
function validarMacAddress(mac) {
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// POST /logs - Criar novo registro de log
app.post('/logs', async (req, res) => {
  try {
    const { cpf, macaddress } = req.body;

    // Validações
    if (!cpf || !macaddress) {
      return res.status(400).json({
        error: 'Campos obrigatórios: cpf, macaddress'
      });
    }

    if (!validarCPF(cpf)) {
      return res.status(400).json({
        error: 'CPF inválido. Deve conter 11 dígitos.'
      });
    }

    if (!validarMacAddress(macaddress)) {
      return res.status(400).json({
        error: 'MAC Address inválido. Formato esperado: XX:XX:XX:XX:XX:XX'
      });
    }

    // Inserir no banco
    const result = await pool.query(
      'INSERT INTO logs (cpf, mac_address, horario) VALUES ($1, $2, NOW()) RETURNING *',
      [cpf, macaddress.toUpperCase()]
    );

    res.status(201).json({
      message: 'Log registrado com sucesso',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Erro ao criar log:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /logs - Listar todos os logs (com paginação)
app.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Buscar logs com paginação
    const logsResult = await pool.query(
      'SELECT * FROM logs ORDER BY horario DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    // Contar total de registros
    const countResult = await pool.query('SELECT COUNT(*) FROM logs');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: logsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /logs/stats - Estatísticas dos logs
app.get('/logs/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT cpf) as cpfs_unicos,
        COUNT(DISTINCT mac_address) as macs_unicos,
        MIN(horario) as primeiro_registro,
        MAX(horario) as ultimo_registro
      FROM logs
    `);

    // Logs das últimas 24 horas
    const last24h = await pool.query(`
      SELECT COUNT(*) as count 
      FROM logs 
      WHERE horario >= NOW() - INTERVAL '24 hours'
    `);

    res.json({
      ...stats.rows[0],
      logs_ultimas_24h: parseInt(last24h.rows[0].count)
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /logs/search - Buscar por CPF ou MAC
app.get('/logs/search', async (req, res) => {
  try {
    const { cpf, mac } = req.query;

    if (!cpf && !mac) {
      return res.status(400).json({
        error: 'Informe pelo menos um parâmetro: cpf ou mac'
      });
    }

    let query = 'SELECT * FROM logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (cpf) {
      query += ` AND cpf LIKE $${paramIndex}`;
      params.push(`%${cpf}%`);
      paramIndex++;
    }

    if (mac) {
      query += ` AND mac_address LIKE $${paramIndex}`;
      params.push(`%${mac.toUpperCase()}%`);
      paramIndex++;
    }

    query += ' ORDER BY horario DESC LIMIT 100';

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Erro na busca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Encerrando conexões...');
  await pool.end();
  process.exit(0);
});
