const SearchComponent = {
    data() {
      return {
        city: '',
        weatherData: null
      };
    },
    methods: {
      async fetchWeatherData() {
        try {
          const response = await axios.get(`http://127.0.0.1:5000/weather/${this.city.toLowerCase()}`);
          this.$emit('update-weather-data', response.data);
        } catch (error) {
          console.error('An error occurred while fetching data:', error);
        }
      },
      handleEnter(event) {
        if(event.key === "Enter") {
          this.fetchWeatherData();
        }
      }
    },
    template: `
    <input type="text" v-model="city" @keypress="handleEnter" placeholder="Enter city" class="search-bar">
  `
};

new Vue({
    el: '#app',
    components: {
        SearchComponent
    },
    methods: {
        updateWeatherData(weatherData) {
            if (weatherData.city) {
                window.location.href = `./results.html?city=${weatherData.city}`;
            }
        },
        handleButtonClick() {
            this.$refs.searchComponent.fetchWeatherData();
        }
    },
    mounted() {
        console.log("Vue app mounted!");
    }
});