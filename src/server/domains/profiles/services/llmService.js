const axios = require('axios');

/**
 * LLM Service
 * Service for integrating with Large Language Models for campaign decision making
 * Primary: Google Gemini (existing key)
 * Secondary: OpenRouter for mouse movement only
 */
class LLMService {
    constructor() {
        // Primary LLM - Google Gemini (using existing key)
        this.geminiApiKey = process.env.GEMINI_API_KEY || null;
        this.geminiModel = process.env.GEMINI_MODEL || 'gemini-pro';
        this.geminiEnabled = !!this.geminiApiKey;
        
        // Secondary LLM - OpenRouter (for mouse movement)
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || null;
        this.openRouterModel = process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free';
        this.openRouterEnabled = !!this.openRouterApiKey;
        
        // Track usage to stay within free limits
        this.dailyUsage = {
            gemini: 0,
            openRouter: 0
        };
        this.resetUsageTimer = setInterval(() => {
            this.dailyUsage = { gemini: 0, openRouter: 0 };
        }, 24 * 60 * 60 * 1000); // Reset daily
    }

    /**
     * Analyze page content using Google Gemini (primary LLM)
     * @param {string} content - Page content to analyze
     * @param {string} profileCategory - Profile category for context
     * @returns {Object} Analysis results
     */
    async analyzePageContent(content, profileCategory = 'newVisitor') {
        if (!this.geminiEnabled) {
            // Removed logger.debug call
            return this.getBasicAnalysis(content, profileCategory);
        }

        // Check daily usage limit (stay within free tier)
        if (this.dailyUsage.gemini >= 500) { // Conservative limit
            // Removed logger.warn call
            return this.getBasicAnalysis(content, profileCategory);
        }

        try {
            // Truncate content to a reasonable length to avoid API limits
            const truncatedContent = content.substring(0, 2000);
            
            const prompt = this.createContentAnalysisPrompt(truncatedContent, profileCategory);
            
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
                {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000 // 10 second timeout
                }
            );

            this.dailyUsage.gemini++;
            
            const analysisText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!analysisText) {
                throw new Error('No analysis text in response');
            }
            
            // Parse the analysis to extract structured data
            const structuredAnalysis = this.parseLLMAnalysis(analysisText);
            
            // Removed logger.info call
            
            return structuredAnalysis;
        } catch (error) {
            // Removed logger.error call
            // Fallback to basic analysis
            return this.getBasicAnalysis(content, profileCategory);
        }
    }

    /**
     * Generate human-like mouse movement patterns using OpenRouter (secondary LLM)
     * @param {Object} pageContext - Context about the page element
     * @returns {Array} Mouse movement coordinates
     */
    async generateMouseMovement(pageContext) {
        // Only use OpenRouter for mouse movement, and only if enabled
        if (!this.openRouterEnabled) {
            // Removed logger.debug call
            return this.getBasicMouseMovement(pageContext);
        }

        // Check daily usage limit (stay within free tier)
        if (this.dailyUsage.openRouter >= 200) { // Conservative limit
            // Removed logger.warn call
            return this.getBasicMouseMovement(pageContext);
        }

        try {
            const prompt = this.createMouseMovementPrompt(pageContext);
            
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: this.openRouterModel,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert at generating realistic human mouse movement patterns. Provide only JSON array of coordinate pairs.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openRouterApiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://your-domain.com', // Required by OpenRouter
                        'X-Title': 'CrawlerBot' // Required by OpenRouter
                    },
                    timeout: 10000 // 10 second timeout
                }
            );

            this.dailyUsage.openRouter++;
            
            const movementText = response.data.choices?.[0]?.message?.content;
            if (!movementText) {
                throw new Error('No movement data in response');
            }
            
            // Parse the movement data
            const movementData = this.parseMouseMovement(movementText);
            
            // Removed logger.info call
            
            return movementData;
        } catch (error) {
            // Removed logger.error call
            // Fallback to basic mouse movement
            return this.getBasicMouseMovement(pageContext);
        }
    }

    /**
     * Create content analysis prompt for Gemini
     * @param {string} content - Page content
     * @param {string} profileCategory - Profile category
     * @returns {string} Prompt for LLM
     */
    createContentAnalysisPrompt(content, profileCategory) {
        return `Analyze the following web page content for a ${profileCategory} user and provide:

1. Interest Score (0-100): How interesting this content is for a ${profileCategory}
2. Key Topics: Main topics discussed (comma separated)
3. Engagement Elements: Interactive elements that could increase engagement
4. Time on Page: Recommended time to spend on this page (seconds)
5. Internal Links: Important internal links to follow (URLs)
6. External Links: Relevant external links (URLs)

Content to analyze:
${content}

Respond in a structured format with these exact sections.`;
    }

    /**
     * Create mouse movement prompt for OpenRouter
     * @param {Object} pageContext - Page context
     * @returns {string} Prompt for LLM
     */
    createMouseMovementPrompt(pageContext) {
        return `Generate realistic human-like mouse movement coordinates for interacting with a web element.
        
Context:
- Element type: ${pageContext.elementType || 'generic'}
- Element size: ${pageContext.width || 100}x${pageContext.height || 50} pixels
- Element position: (${pageContext.x || 0}, ${pageContext.y || 0})
- Interaction type: ${pageContext.interactionType || 'click'}
- User profile: ${pageContext.userProfile || 'average'}

Provide a JSON array of [x,y] coordinate pairs representing natural mouse movement.
Include 5-15 coordinate pairs that show realistic human movement patterns.
Start from a random position and end at the target element.
Return ONLY the JSON array, no other text.`;
    }

    /**
     * Parse LLM analysis response
     * @param {string} analysis - LLM response
     * @returns {Object} Structured analysis data
     */
    parseLLMAnalysis(analysis) {
        const result = {
            interestScore: 50,
            keyTopics: [],
            engagementElements: [],
            timeOnPage: 30,
            internalLinks: [],
            externalLinks: []
        };

        try {
            // Extract interest score
            const interestScoreMatch = analysis.match(/Interest Score.*?:\s*(\d+)/i);
            if (interestScoreMatch) {
                result.interestScore = parseInt(interestScoreMatch[1]);
            }

            // Extract key topics
            const topicsMatch = analysis.match(/Key Topics.*?:\s*(.*)/i);
            if (topicsMatch) {
                result.keyTopics = topicsMatch[1].split(',').map(topic => topic.trim());
            }

            // Extract engagement elements
            const engagementMatch = analysis.match(/Engagement Elements.*?:\s*(.*)/i);
            if (engagementMatch) {
                result.engagementElements = engagementMatch[1].split(',').map(element => element.trim());
            }

            // Extract time on page
            const timeMatch = analysis.match(/Time on Page.*?:\s*(\d+)/i);
            if (timeMatch) {
                result.timeOnPage = parseInt(timeMatch[1]);
            }

            // Extract internal links
            const internalLinksMatch = analysis.match(/Internal Links.*?:\s*(.*)/i);
            if (internalLinksMatch) {
                const linksText = internalLinksMatch[1];
                // Extract URLs using regex
                const urlRegex = /https?:\/\/[^\s,]+/g;
                result.internalLinks = linksText.match(urlRegex) || [];
            }

            // Extract external links
            const externalLinksMatch = analysis.match(/External Links.*?:\s*(.*)/i);
            if (externalLinksMatch) {
                const linksText = externalLinksMatch[1];
                // Extract URLs using regex
                const urlRegex = /https?:\/\/[^\s,]+/g;
                result.externalLinks = linksText.match(urlRegex) || [];
            }
        } catch (error) {
            // Removed logger.warn call
        }

        return result;
    }

    /**
     * Parse mouse movement response
     * @param {string} movementText - LLM response
     * @returns {Array} Array of coordinate pairs
     */
    parseMouseMovement(movementText) {
        try {
            // Try to extract JSON array from response
            const jsonMatch = movementText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const movementArray = JSON.parse(jsonMatch[0]);
                // Validate that it's an array of coordinate pairs
                if (Array.isArray(movementArray) && movementArray.length > 0) {
                    return movementArray.filter(coord => 
                        Array.isArray(coord) && coord.length === 2 && 
                        typeof coord[0] === 'number' && typeof coord[1] === 'number'
                    );
                }
            }
        } catch (error) {
            // Removed logger.warn call
        }
        
        // Return basic movement if parsing fails
        return this.getBasicMouseMovement({});
    }

    /**
     * Generate basic content analysis when LLM is not available
     * @param {string} content - Page content
     * @param {string} profileCategory - Profile category
     * @returns {Object} Basic analysis
     */
    getBasicAnalysis(content, profileCategory) {
        const wordCount = content.split(/\s+/).length;
        const linkCount = (content.match(/<a\s+/g) || []).length;
        const imageCount = (content.match(/<img\s+/g) || []).length;
        
        // Simple scoring based on content elements
        let interestScore = 50;
        interestScore += Math.min(30, wordCount * 0.1);
        interestScore += Math.min(20, linkCount * 2);
        interestScore += Math.min(10, imageCount * 1);
        interestScore = Math.min(100, Math.max(0, interestScore));
        
        // Profile-specific adjustments
        switch (profileCategory) {
            case 'loyalUser':
                interestScore = Math.min(100, interestScore * 1.2);
                break;
            case 'newVisitor':
                interestScore = interestScore * 0.8;
                break;
        }
        
        return {
            interestScore: Math.round(interestScore),
            keyTopics: ['general'],
            engagementElements: linkCount > 0 ? ['links'] : [],
            timeOnPage: Math.min(120, Math.max(10, wordCount * 0.2)),
            internalLinks: [],
            externalLinks: []
        };
    }

    /**
     * Generate basic mouse movement when LLM is not available
     * @param {Object} pageContext - Page context
     * @returns {Array} Basic mouse movement coordinates
     */
    getBasicMouseMovement(pageContext) {
        const x = pageContext.x || 0;
        const y = pageContext.y || 0;
        const width = pageContext.width || 100;
        const height = pageContext.height || 50;
        
        // Generate simple movement from random start to target
        const startX = Math.max(0, x + (Math.random() * 200 - 100));
        const startY = Math.max(0, y + (Math.random() * 200 - 100));
        const endX = x + width / 2;
        const endY = y + height / 2;
        
        // Create 5-10 intermediate points
        const points = [];
        const numPoints = 5 + Math.floor(Math.random() * 6);
        
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            // Add some randomness to make it look more human
            const jitterX = (Math.random() - 0.5) * 20;
            const jitterY = (Math.random() - 0.5) * 20;
            points.push([
                startX + (endX - startX) * t + jitterX,
                startY + (endY - startY) * t + jitterY
            ]);
        }
        
        return points;
    }

    /**
     * Check if primary LLM (Gemini) is properly configured
     * @returns {boolean} Configuration status
     */
    isConfigured() {
        return this.geminiEnabled;
    }

    /**
     * Check if secondary LLM (OpenRouter) is properly configured
     * @returns {boolean} Configuration status
     */
    isMouseMovementConfigured() {
        return this.openRouterEnabled;
    }

    /**
     * Get current usage statistics
     * @returns {Object} Usage statistics
     */
    getUsageStats() {
        return {
            gemini: this.dailyUsage.gemini,
            openRouter: this.dailyUsage.openRouter,
            limits: {
                gemini: 500, // Conservative limit
                openRouter: 200 // Conservative limit
            }
        };
    }
}

module.exports = new LLMService();