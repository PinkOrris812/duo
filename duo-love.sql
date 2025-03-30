CREATE DATABASE duo;
USE duo;

-- Create Languages table to store supported languages
CREATE TABLE Languages (
    language_code VARCHAR(10) PRIMARY KEY,
    language_name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Create Categories table for love phrase categories
CREATE TABLE Categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- Create Users table
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duolingo_user BOOLEAN NOT NULL DEFAULT FALSE,
    duolingo_user_id VARCHAR(100),
    auth_provider VARCHAR(50) DEFAULT 'email',
    UNIQUE (username),
    UNIQUE (email)
);

-- Create Phrases table for user submissions with counters initialized to 0
CREATE TABLE Phrases (
    phrase_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content VARCHAR(255) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    category_id INT NOT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    score FLOAT GENERATED ALWAYS AS ((upvotes - downvotes)) STORED,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (language_code) REFERENCES Languages(language_code),
    FOREIGN KEY (category_id) REFERENCES Categories(category_id)
);

-- Create Votes table to track user votes on phrases
CREATE TABLE Votes (
    vote_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    phrase_id INT NOT NULL,
    vote_value INT NOT NULL CHECK (vote_value IN (-1, 0, 1)),
    voted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (phrase_id) REFERENCES Phrases(phrase_id),
    UNIQUE (user_id, phrase_id)
);

-- Create indexes for performance optimization
CREATE INDEX idx_phrases_score ON Phrases(score DESC);
CREATE INDEX idx_phrases_language ON Phrases(language_code);
CREATE INDEX idx_phrases_category ON Phrases(category_id);
CREATE INDEX idx_phrases_featured ON Phrases(featured);

-- Insert sample data for Categories
INSERT INTO Categories (name, description) VALUES
('Friends', 'Phrases to express love to friends'),
('Family', 'Phrases to express love to family members'),
('Romantic', 'Phrases to express romantic love'),
('Duo Devotion', 'Phrases to express love specifically for Duo');

-- Insert sample data for Languages (based on Duolingo supported languages)
INSERT INTO Languages (language_code, language_name) VALUES
('en', 'English'),
('es', 'Spanish'),
('fr', 'French'),
('de', 'German'),
('it', 'Italian'),
('pt', 'Portuguese'),
('ru', 'Russian'),
('ja', 'Japanese'),
('ko', 'Korean'),
('zh', 'Chinese'),
('ar', 'Arabic'),
('hi', 'Hindi'),
('tr', 'Turkish');

-- Create triggers to incrementally update vote counts
-- Handle vote insertion
DELIMITER //
CREATE TRIGGER after_vote_insert
AFTER INSERT ON Votes
FOR EACH ROW
BEGIN
    IF NEW.vote_value = 1 THEN
        UPDATE Phrases SET upvotes = upvotes + 1 WHERE phrase_id = NEW.phrase_id;
    ELSEIF NEW.vote_value = -1 THEN
        UPDATE Phrases SET downvotes = downvotes + 1 WHERE phrase_id = NEW.phrase_id;
    END IF;
END //


-- Handle vote updates
CREATE TRIGGER after_vote_update
AFTER UPDATE ON Votes
FOR EACH ROW
BEGIN
    -- If changing from upvote to downvote
    IF OLD.vote_value = 1 AND NEW.vote_value = -1 THEN
        UPDATE Phrases 
        SET upvotes = upvotes - 1, downvotes = downvotes + 1 
        WHERE phrase_id = NEW.phrase_id;
    
    -- If changing from downvote to upvote
    ELSEIF OLD.vote_value = -1 AND NEW.vote_value = 1 THEN
        UPDATE Phrases 
        SET upvotes = upvotes + 1, downvotes = downvotes - 1 
        WHERE phrase_id = NEW.phrase_id;
    
    -- If removing an upvote (changing to 0)
    ELSEIF OLD.vote_value = 1 AND NEW.vote_value = 0 THEN
        UPDATE Phrases 
        SET upvotes = upvotes - 1
        WHERE phrase_id = NEW.phrase_id;
    
    -- If removing a downvote (changing to 0)
    ELSEIF OLD.vote_value = -1 AND NEW.vote_value = 0 THEN
        UPDATE Phrases 
        SET downvotes = downvotes - 1
        WHERE phrase_id = NEW.phrase_id;
    
    -- If adding an upvote from neutral
    ELSEIF OLD.vote_value = 0 AND NEW.vote_value = 1 THEN
        UPDATE Phrases 
        SET upvotes = upvotes + 1
        WHERE phrase_id = NEW.phrase_id;
    
    -- If adding a downvote from neutral
    ELSEIF OLD.vote_value = 0 AND NEW.vote_value = -1 THEN
        UPDATE Phrases 
        SET downvotes = downvotes + 1
        WHERE phrase_id = NEW.phrase_id;
    END IF;
END //


-- Create view for leaderboard
CREATE VIEW phrase_leaderboard AS
SELECT 
    p.phrase_id,
    p.content,
    p.language_code,
    l.language_name,
    c.name AS category_name,
    u.username AS submitted_by,
    p.submitted_at,
    p.upvotes,
    p.downvotes,
    p.score
FROM 
    Phrases p
JOIN 
    Languages l ON p.language_code = l.language_code
JOIN 
    Categories c ON p.category_id = c.category_id
JOIN 
    Users u ON p.user_id = u.user_id
ORDER BY 
    p.score DESC;
-- Create stored procedure to retrieve top phrases by language
DELIMITER //
CREATE PROCEDURE get_top_phrases_by_language(
    IN p_language_code VARCHAR(10),
    IN p_limit INT
)
BEGIN
    SELECT 
        p.phrase_id,
        p.content,
        c.name AS category,
        p.score,
        u.username AS submitted_by
    FROM 
        Phrases p
    JOIN 
        Users u ON p.user_id = u.user_id
    JOIN 
        Categories c ON p.category_id = c.category_id
    WHERE 
        p.language_code = p_language_code
    ORDER BY 
        p.score DESC
    LIMIT p_limit;
END //
DELIMITER ;

