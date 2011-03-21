/*
* copyright 2010 Ryan Day
*
* Licensed under the MIT license:
* http://www.opensource.org/licenses/mit-license.php
*
*/
//my old scraper kinda sucks 
var scraper = require(__dirname+'/lib/scraper.js')
	,rq = require(__dirname+'/lib/rq.js')// but my new one rocks
	,url = require('url');
	
module.exports = exports = {
	search:function(title,cb){
		//true+grit+2010
		title = (title+'').trim();
		if(!title.length) {
			cb('title to search required',false);
			return false; 
		}

		rq('http://www.netflix.com/Search?v1='+encodeURIComponent(title),function(err,body){
			if(body) {
				var document = scraper.loadDom(body);
				scraper.injectJquery(document,function(err,window){
					try{
						var response = processDom(window);
					}catch(err){}
					
					cb(err,response);
				});
			} else {
				cb(err,null);
			}
		});
		
		function processDom(window){

			var response = {
				titles:{},
				exact:[],// exact match symbols and case excluded
				partial:[],// head or tail match but not whole
				approx:[]//not head or tail match
			};

			var $ = window.jQuery;
			
			$("#searchResultsPrimary ol li").each(function(){
				if($(this).hasClass('roleStart')){
					//stop processing results here.
					return false;
				}
				var title = {};
				
				var cont = $(this).find('.agMovie')
					, img= cont.find(".boxShot img");
				title.thumb = img.attr('src');
				title.href = img.parents('a').attr('href');
				title.name = cont.find(".title a").eq(0).text();
				
				title.year = false;
				var children = cont.find(".altYearRating")[0].childNodes;
				$.each(children,function(k,v){
					if(v.nodeName == "#text") {
						matches = (v.nodeValue||'').trim().match(/\([0-9]{4,4}\)/g); 
						if(matches){
							title.year = matches[0].replace(/[()]/g,'');
							return false;
						}
					}
				});
				
				title.rating = cont.find(".altYearRating nobr").text().trim().toUpperCase();
				title.id = url.parse(title.href).pathname.split('/').pop();
				//title.name =
				response.titles[title.id] = title;
			});

			return response;
		}
	}
};