var googleLoginService = angular.module('GoogleLoginService', ['ngStorage']);
googleLoginService.factory('timeStorage', ['$localStorage', function ($localStorage) {
        var timeStorage = {};
        timeStorage.cleanUp = function () {
            var cur_time = new Date().getTime();
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key.indexOf('_expire') === -1) {
                    var new_key = key + "_expire";
                    var value = localStorage.getItem(new_key);
                    if (value && cur_time > value) {
                        localStorage.removeItem(key);
                        localStorage.removeItem(new_key);
                    }
                }
            }
        };
        timeStorage.remove = function (key) {
            this.cleanUp();
            var time_key = key + '_expire';
            $localStorage[key] = false;
            $localStorage[time_key] = false;
        };
        timeStorage.set = function (key, data, hours) {
            this.cleanUp();
            $localStorage[key] = data;
            var time_key = key + '_expire';
            var time = new Date().getTime();
            time = time + (hours * 1 * 60 * 60 * 1000);
            $localStorage[time_key] = time;
        };
        timeStorage.get = function (key) {
            this.cleanUp();
            var time_key = key + "_expire";
            if (!$localStorage[time_key]) {
                return false;
            }
            var expire = $localStorage[time_key] * 1;
            if (new Date().getTime() > expire) {
                $localStorage[key] = null;
                $localStorage[time_key] = null;
                return false;
            }
            return $localStorage[key];
        };
        return timeStorage;
    }]);


googleLoginService.factory('googleLogin', [
    '$http', '$q', '$interval', '$log', 'timeStorage',
    function ($http, $q, $interval, $log, timeStorage) {
        var service = {};
        service.access_token = false;
        service.redirect_url = 'http://localhost:8100/';
        service.client_id = '116421120632-otf7afrfqtfeiqlibtlatnou8964bge0.apps.googleusercontent.com';
        service.secret = 'lZ5cGSygNxc3EopNN04JU4JL';
        service.scope = 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/plus.me';
        service.gulp = function (url, name) {
            url = url.substring(url.indexOf('?') + 1, url.length);

            return url.replace('code=', '');

//            name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
//            var regexS = "[\\#&]" + name + "=([^&#]*)";
//            var regex = new RegExp(regexS);
//            var results = regex.exec(url);
//            if (results == null)
//                return "";
//            else
//                return results[1];

//            var match,
//                    pl = /\+/g, // Regex for replacing addition symbol with a space
//                    search = /([^&=]+)=?([^&]*)/g,
//                    decode = function (s) {
//                        return decodeURIComponent(s.replace(pl, " "));
//                    },
//                    query = url;
//
//            var urlParams = {};
//            while (match = search.exec(query))
//                urlParams[decode(match[1])] = decode(match[2]);
//
//            if (urlParams.name) {
//                return urlParams.name;
//            } else {
//                return false;
//            }

        };



        service.authorize = function (options) {
            var def = $q.defer();
            var self = this;

            var access_token = timeStorage.get('google_access_token');
            if (access_token) {
                $log.info('Direct Access Token :' + access_token);
                service.getUserInfo(access_token, def);
            } else {

                var params = 'client_id=' + encodeURIComponent(options.client_id);
                params += '&redirect_uri=' + encodeURIComponent(options.redirect_uri);
                params += '&response_type=code';
                params += '&scope=' + encodeURIComponent(options.scope);
                var authUrl = 'https://accounts.google.com/o/oauth2/auth?' + params;

                var win = window.open(authUrl, '_blank', 'location=no,toolbar=no,width=800, height=800');
                var context = this;

                if (ionic.Platform.isWebView()) {
                    console.log('using in app browser');
                    win.addEventListener('loadstart', function (data) {
                        console.log('load start');
                        if (data.url.indexOf(context.redirect_url) === 0) {
                            console.log('redirect url found ' + context.redirect_url);
                            console.log('window url found ' + data.url);
                            win.close();
                            var url = data.url;
                            var access_code = context.gulp(url, 'code');
                            //var access_code = context.gulp(url, 'code');
                            if (access_code) {
                                //context.validateToken(access_code, def);
                                context.getAuthorizationCode(access_code,def);
                            } else {
                                def.reject({error: 'Access Code Not Found'});
                            }
                        }

                    });
                } else {
                    console.log('InAppBrowser not found11');
                    var pollTimer = $interval(function () {
                        try {
                            console.log("google window url " + win.document.URL);
                            if (win.document.URL.indexOf(context.redirect_url) === 0) {
                                console.log('redirect url found');
                                win.close();
                                $interval.cancel(pollTimer);
                                pollTimer = false;
                                var url = win.document.URL;
                                $log.debug('Final URL ' + url);
                                var access_code = context.gulp(url, 'code');
                                if (access_code) {
                                    $log.info('Access Code: ' + access_code);
                                    context.getAuthorizationCode(access_code,def);
                                    //context.validateToken(access_code, def);
                                } else {
                                    def.reject({error: 'Access Code Not Found'});
                                }
                            }
                        } catch (e) {
                        }
                    }, 100);
                }
            }
            return def.promise;
        };
        
        service.getAuthorizationCode=function (authorization_code,def) {
            var context = this;
             var headers = {
                    'Access-Control-Allow-Origin' : '*',
                  };
          var access_code =  $http.get('http://spinnerbank-api-external.herokuapp.com/v2/oAuth2/accessToken4', {
              method: 'get',
              params : {
                'code':authorization_code
              },
              
             
              
            }).then(function(data){

                $log.debug(data);
                var access_token = data.data.jwt;
                var expires_in = 3599;
                expires_in = expires_in * 1 / (60 * 60);
                timeStorage.set('google_access_token', access_token, expires_in);
                if (access_token) {
                    $log.info('Access Token :' + access_token);
                    context.getUserInfo(access_token, def);
                } else {
                    def.reject({error: 'Access Token Not Found'});
                }
            });
        };

        service.logout = function() {

            timeStorage.remove('google_access_token');

        };

        service.getAccess_token = function() {
           return timeStorage.get('google_access_token');
        };

        service.getUserInfo = function (access_token, def) {
             
            var headers = {
                    'jwt': access_token
                  };
             var http = $http({
                url: 'https://spinnerbank-api-external.herokuapp.com/v1/oAuth2/userInfo',
                method: 'GET',
                params: {
                    access_token: access_token
                },
                //headers: headers
            });
            http.then(function (data) {
                $log.debug(data);
                var user_data = data.data;
                var user = {
                    name: user_data.name,
                    gender: user_data.gender,
                    email: user_data.email,
                    google_id: user_data.sub,
                    picture: user_data.picture,
                    profile: user_data.profile
                };
                def.resolve(user);
            });
        };
        service.getUserFriends = function () {
            var access_token = this.access_token;
            var http = $http({
                url: 'https://www.googleapis.com/plus/v1/people/me/people/visible',
                method: 'GET',
                params: {
                    access_token: access_token
                }
            });
            http.then(function (data) {
                console.log(data);
            });
        };
        service.startLogin = function () {
            var def = $q.defer();
            var promise = this.authorize({
                client_id: this.client_id,
                client_secret: this.secret,
                redirect_uri: this.redirect_url,
                scope: this.scope
            });
            promise.then(function (data) {
                def.resolve(data);
            }, function (data) {
                $log.error(data);
                def.reject(data.error);
            });
            return def.promise;
        };
        return service;
    }
]);