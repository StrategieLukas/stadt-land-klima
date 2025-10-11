-- Change rating values (old yellow to new orange, old lightgreen to new lightgreen value)
UPDATE ratings_measures SET rating = '0.25' WHERE rating = '0.3333';
UPDATE ratings_measures SET rating = '0.75' WHERE rating = '0.6666';
-- Change choices for measures and all ratings accordingly so that previous yellow is replaced with orange
UPDATE ratings_measures SET choices = '6' WHERE choices = '1';
UPDATE ratings_measures SET choices = '7' WHERE choices = '3';
UPDATE measures SET choices_rating = '6' WHERE choices_rating = '1';
UPDATE measures SET choices_rating = '7' WHERE choices_rating = '3';
