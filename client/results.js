function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }
  
  const ResultsApp = new Vue({
    el: '#results-app',
    data: {
      city: getQueryParam('city'),
      weatherData: null
    },
    methods: {
      async fetchWeatherData() {
        try {
          const response = await axios.get(`http://127.0.0.1:5000/weather/${this.city.toLowerCase()}`);
          this.weatherData = response.data;
          this.weatherData.city = this.weatherData.city.charAt(0).toUpperCase() + this.weatherData.city.slice(1);
        } catch (error) {
          console.error('An error occurred while fetching data:', error);
        }
      }
    },
    mounted() {
      this.fetchWeatherData();
    }
  });