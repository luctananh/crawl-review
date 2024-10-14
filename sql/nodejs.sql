CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    country VARCHAR(255),
    rating VARCHAR(50),
    time VARCHAR(100),
    feedback TEXT,
    image TEXT
);
