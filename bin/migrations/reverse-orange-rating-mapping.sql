-- Change ratings from new-orange to old-yellow and from new-lightgreen to old-lightgreen
UPDATE ratings_measures SET rating = '0.3333' WHERE rating = '0.25';
UPDATE ratings_measures SET rating = '0.6666' WHERE rating = '0.75';
-- Change choices for measures and all ratings accordingly so that previous orange is replaced with yellow
UPDATE ratings_measures SET choices = '1' WHERE choices = '6';
UPDATE ratings_measures SET choices = '3' WHERE choices = '7';
UPDATE measures SET choices_rating = '1' WHERE choices_rating = '6';
UPDATE measures SET choices_rating = '3' WHERE choices_rating = '7';  
