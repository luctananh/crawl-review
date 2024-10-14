const { Client } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3001;

// Connect to PostgreSQL
const client = new Client({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT
});

client.connect();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/getAllReviews', async (req, res) => {
    const link = req.body.productURL;
    if (!link) {
        return res.status(400).send('Please enter a product link!');
    }

    try {
        const parts = link.split('/');
        const lastSegment = parts.pop() || parts.pop();  // Handle trailing slashes
        const productId = lastSegment.split('.')[0];

        let allReviews = [];
        let page = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            // Fetch the reviews page via axios
            const feedbackUrl = `https://feedback.aliexpress.com/display/productEvaluation.htm?v=2&productId=${productId}&ownerMemberId=2668009148&companyId=2668009148&memberType=seller&startValidDate=&i18n=true&page=${page}`;
            
            const response = await axios.get(feedbackUrl);
            const $ = cheerio.load(response.data);

            // Extract reviews using cheerio
            const reviews = $('.feedback-item').map((index, element) => {
                let reviewName = $(element).find('.fb-user-info .user-name a').text() || $(element).find('.fb-user-info .user-name').text();
                let reviewCountry = $(element).find('.fb-user-info .user-country b').text();
                let reviewContent = $(element).find('.buyer-feedback span:nth-child(1)').text();
                let reviewTime = $(element).find('.buyer-feedback span:nth-child(2)').text();
                let reviewRating = $(element).find('.star-view span').attr('style');

                let reviewImage = $(element).find('.feedback-photo img').attr('src') || $(element).find('img').attr('src');

                // Handle rating based on the width value
                let reviewRatingValue;
                switch(reviewRating) {
                    case 'width:100%': reviewRatingValue = '5 stars'; break;
                    case 'width:80%': reviewRatingValue = '4 stars'; break;
                    case 'width:60%': reviewRatingValue = '3 stars'; break;
                    case 'width:40%': reviewRatingValue = '2 stars'; break;
                    case 'width:20%': reviewRatingValue = '1 star'; break;
                    default: reviewRatingValue = '5 stars';
                }

                return {
                    name: reviewName,
                    country: reviewCountry,
                    rating: reviewRatingValue,
                    time: reviewTime,
                    feedback: reviewContent,
                    image: reviewImage
                };
            }).get();

            // Insert each review into the database
            for (let review of reviews) {
                try {
                    await client.query('INSERT INTO reviews (name, country, rating, time, feedback, image) VALUES ($1, $2, $3, $4, $5, $6)', 
                    [review.name, review.country, review.rating, review.time, review.feedback, review.image]);
                } catch (error) {
                    console.error('Database insertion error:', error);
                }
            }

            allReviews = allReviews.concat(reviews);

            // Check for next page
            const nextPageButton = $('.ui-pagination-next:not(.ui-pagination-disabled)');
            hasNextPage = nextPageButton.length > 0;
            page++;

            // Delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        res.json(allReviews);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while fetching reviews');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
