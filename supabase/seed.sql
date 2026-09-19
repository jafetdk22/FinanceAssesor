-- Catálogo inicial de activos (sólo metadatos; los precios se obtienen de proveedores reales)
insert into public.assets (symbol, name, asset_type, market, exchange, country, currency, sector, industry) values
('AAPL','Apple Inc.','STOCK','US','NASDAQ','US','USD','Technology','Consumer Electronics'),
('MSFT','Microsoft Corporation','STOCK','US','NASDAQ','US','USD','Technology','Software'),
('GOOGL','Alphabet Inc.','STOCK','US','NASDAQ','US','USD','Communication Services','Internet Content'),
('AMZN','Amazon.com Inc.','STOCK','US','NASDAQ','US','USD','Consumer Cyclical','Internet Retail'),
('NVDA','NVIDIA Corporation','STOCK','US','NASDAQ','US','USD','Technology','Semiconductors'),
('JNJ','Johnson & Johnson','STOCK','US','NYSE','US','USD','Healthcare','Drug Manufacturers'),
('JPM','JPMorgan Chase & Co.','STOCK','US','NYSE','US','USD','Financial Services','Banks'),
('XOM','Exxon Mobil Corporation','STOCK','US','NYSE','US','USD','Energy','Oil & Gas'),
('PG','Procter & Gamble','STOCK','US','NYSE','US','USD','Consumer Defensive','Household Products'),
('KO','The Coca-Cola Company','STOCK','US','NYSE','US','USD','Consumer Defensive','Beverages'),
('SPY','SPDR S&P 500 ETF','ETF','US','NYSE ARCA','US','USD','Diversified','Index ETF'),
('QQQ','Invesco QQQ Trust','ETF','US','NASDAQ','US','USD','Technology','Index ETF'),
('VTI','Vanguard Total Stock Market ETF','ETF','US','NYSE ARCA','US','USD','Diversified','Index ETF'),
('VNQ','Vanguard Real Estate ETF','ETF','US','NYSE ARCA','US','USD','Real Estate','REIT ETF'),
('GLD','SPDR Gold Shares','ETF','US','NYSE ARCA','US','USD','Commodities','Gold')
on conflict do nothing;
