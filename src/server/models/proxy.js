const { v4: uuidv4 } = require('uuid');

class ProxyModel {
    constructor({
        id = uuidv4(),
        host,
        port,
        protocol = 'http',
        username = null,
        password = null,
        status = 'unknown',
        failure_count = 0,
        success_count = 0,
        average_response_time = 0,
        assigned_profiles = [],
        geolocation = null,
        ip = null,
        createdAt = new Date().toISOString(),
        // Additional properties from proxyManager.js if needed
        provider = null,
        country = null,
        countryName = null,
        timezone = null,
        language = null,
        city = null,
        region = null,
        coordinates = null,
        publicIPRanges = null,
        weight = 0,
        isActive = false,
        sessionId = null,
        index = null,
        format = null,
        expiredAt = null // For tracking expired proxies
    }) {
        if (!host || !port) {
            throw new Error('Proxy requires host and port');
        }

        this.id = id;
        this.host = host;
        this.port = port;
        this.protocol = protocol;
        this.username = username;
        this.password = password;
        this.status = status;
        this.failure_count = failure_count;
        this.success_count = success_count;
        this.average_response_time = average_response_time;
        this.assigned_profiles = assigned_profiles;
        this.geolocation = geolocation;
        this.ip = ip;
        this.createdAt = createdAt;

        // Additional properties
        this.provider = provider;
        this.country = country;
        this.countryName = countryName;
        this.timezone = timezone;
        this.language = language;
        this.city = city;
        this.region = region;
        this.coordinates = coordinates;
        this.publicIPRanges = publicIPRanges;
        this.weight = weight;
        this.isActive = isActive;
        this.sessionId = sessionId;
        this.index = index;
        this.format = format;
        this.expiredAt = expiredAt;
    }

    // Method to convert to JSON, similar to other models
    toJSON() {
        // Ensure geolocation object exists and has country if country field is set
        let geolocation = this.geolocation;
        if (this.country && (!geolocation || !geolocation.country)) {
            geolocation = geolocation || {};
            geolocation.country = this.country;
        }
        
        return {
            id: this.id,
            host: this.host,
            port: this.port,
            protocol: this.protocol,
            username: this.username,
            status: this.status,
            failure_count: this.failure_count,
            success_count: this.success_count,
            average_response_time: this.average_response_time,
            assigned_profiles: this.assigned_profiles,
            geolocation: geolocation,
            ip: this.ip,
            createdAt: this.createdAt,
            provider: this.provider,
            country: this.country,
            countryName: this.countryName,
            timezone: this.timezone,
            language: this.language,
            city: this.city,
            region: this.region,
            coordinates: this.coordinates,
            publicIPRanges: this.publicIPRanges,
            weight: this.weight,
            isActive: this.isActive,
            sessionId: this.sessionId,
            index: this.index,
            format: this.format,
            expiredAt: this.expiredAt
        };
    }

    // Static method to create from JSON, useful for loading from disk
    static fromJSON(json) {
        return new ProxyModel(json);
    }
}

module.exports = ProxyModel;