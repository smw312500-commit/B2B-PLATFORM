USE em_agent;

CREATE TABLE IF NOT EXISTS material_specs (
  material_type  VARCHAR(50)    PRIMARY KEY,
  unit           VARCHAR(20)    NOT NULL,          -- 단위 (롤, 개)
  weight_kg      DECIMAL(10, 4) NOT NULL,          -- 단위당 무게(kg)
  unit_qty        INT            NOT NULL DEFAULT 1, -- 기준 수량 (칩은 50000개 단위)
  note           VARCHAR(200)
);

INSERT INTO material_specs (material_type, unit, weight_kg, unit_qty, note) VALUES
('FABRIC',        '롤',  1.2000, 1,     '원단 1롤 = 1.2kg'),
('STICKER_PAPER', '롤',  1.3000, 1,     '스티커지 1롤 = 1.3kg'),
('CHIP',          '개',  0.0000300, 1,  '칩 50,000개 = 1.5kg → 1개 = 0.00003kg');
