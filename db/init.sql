-- Criação da tabela de logs
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL,
    mac_address VARCHAR(17) NOT NULL,
    horario TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance nas consultas
CREATE INDEX idx_logs_cpf ON logs(cpf);
CREATE INDEX idx_logs_horario ON logs(horario DESC);
CREATE INDEX idx_logs_mac_address ON logs(mac_address);

-- Inserir alguns dados de exemplo (opcional)
INSERT INTO logs (cpf, mac_address, horario) VALUES
    ('123.456.789-00', 'AA:BB:CC:DD:EE:FF', NOW() - INTERVAL '2 hours'),
    ('987.654.321-00', '11:22:33:44:55:66', NOW() - INTERVAL '1 hour'),
    ('111.222.333-44', 'AB:CD:EF:12:34:56', NOW());
