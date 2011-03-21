/*
* copyright 2010 Ryan Day
*
* Licensed under the MIT license:
* http://www.opensource.org/licenses/mit-license.php
*
*/
var scraper = require(__dirname+'/lib/scraper.js');

module.exports = exports = {
	//search('title',cb[(error,data)])
	search:function(title,cb){
		if(!(title||'').length) {
			cb('title to search required',false);
			return false; 
		}
		scraper.get('http://www.imdb.com/find?s=tt&q='+encodeURIComponent(title),function(body,response){
			var document = scraper.loadDom(body);
			scraper.injectJquery(document,function(err,window){
				var $ = window.jQuery
					,main = $("#main")
					,subjectPs = main.children('p');

				var response = {
					titles:{},
					popular:[],
					exact:[],
					partial:[],
					approx:[]
				}
				,media = {}; 

				try{
				subjectPs.each(function(){
					var text = this.textContent.trim(); 
					//console.log('text: '+text);
					if(text.indexOf('Media from') == 0) {

						var title = $(this).find('a').text()
							, titleId = $(this).find('a').attr('href').split('/')[2];
						
						// handle media content
						//
						$(nextTag('table',this)).find(".video").each(function(){
							var href = $(this).parent().attr('href');
							//this kinda sucks but i dont want any video on demand links only those i know i can chase for real mp4 files
							if(href.indexOf('/video/screenplay/') == 0){
								//found a preview/clip
								if(!response.titles[titleId]) response.titles[titleId] = {};
								if(!response.titles[titleId].media) response.titles[titleId].media = [];
								
								response.titles[titleId].media.push({
									type:'video'
									,name:title
									,href:'http://www.imdb.com'+href
									,thumb:this.src
								});
							}
						});

					} else if(text.indexOf('Popular') == 0) {

						var popular = processTitles($(this).children('table').eq(0),$);
						mergeRecursive(popular,response.titles);

						$.each(popular,function(id,v){
							response.popular.push(id);
						});
					} else if(text.indexOf('Titles') == 0){
						var titles = processTitles($(this).children('table').eq(0),$);
						mergeRecursive(titles,response.titles);
						// handle titles
						if(text.indexOf('Exact') != -1) {
							$.each(titles,function(id,v){
								response.exact.push(id);
							});
						} else if(text.indexOf('Partial') != -1) {
							$.each(titles,function(id,v){
								response.partial.push(id);
							});
						} else if(text.indexOf('Approx') != -1) {
							$.each(titles,function(id,v){
								response.approx.push(id);
							});
						}
					}
				});
				}catch(err){/*forward error to cb*/}
				
				cb(err,response);
				
			});
			
		});
		
		function processTitles(titleTable,$){

			try{
			var titles = {};
			var as = titleTable.find("a");

			as.each(function(){
				var href = $(this).attr('href');

				if(href.indexOf('/title/') != -1) {
					//is a title
					var title = this.textContent
						, titleId = href.split('/')[2];
					
					if(!titles[titleId]) titles[titleId] = {};
					
					titles[titleId].name = title;
					titles[titleId].href = 'http://www.imdb.com'+href;
					titles[titleId].thumb = $(this).parents('tr').find('td:first a img').attr('src')||null;
					
					var childNodes = this.parentNode.childNodes;
					$.each(childNodes,function(k,v){
						if(v.nodeName == "#text") {
							matches = (v.nodeValue||'').trim().match(/\([0-9]{4,4}\)/g); 
							if(matches){
								titles[titleId].year = matches[0].replace(/[()]/g,'');
								return false;
							}
						}
					});
				}
			});
			}catch(e) {
				console.log(e.toString()+' '+e.stack);
			}
			//console.log('DONE!!!!!!!!!!!!!!!');
			return titles;
		}
		//jQuery next doesnt seem to work for me now =/
		function nextTag(tagName,current){
			var children = current.parentNode.childNodes;
			var look = false;
			for( var i =0,j=children.length;i<j;i++) {
				if(children[i].nodeName == "#text") continue;
				if(look){
					if( children[i].nodeName.toUpperCase() == tagName.toUpperCase()) {
						//console.log('FOUND MATCH');
						return children[i];
					} else {
						//console.log('NO MATCH: '+ children[i].nodeName.toUpperCase());
					}
				}
				
				if(children[i] === current) {
					//console.log('found current element!');
					//console.log(children[i].textContent);
					look = true;
					continue;
				}
			}
			//console.log('failed to find next '+tagName);
			return null;
		}
		
		function mergeRecursive(add,all){
			for(var i in add){
				//NOTE null key in add will not override all[i] if all[i] is an object
				if(all[i] && typeof add[i] == typeof all[i] && typeof all[i] == 'object'  && !(all[i] instanceof Array)){
					//if types differ new type wins
					mergeRecursive(add[i],all[i]);
					continue;
				}
				all[i] = add[i];
			}
		};
	},
	details:function(titleId,cb){
		scraper.get('http://www.imdb.com/title/'+titleId+'/',function(body,response){

			var document = scraper.loadDom(body);
			scraper.injectJquery(document,function(err,window){
				var $ = window.jQuery;
				response = {};
				try{
					response.image = $("#img_primary img").attr('src');
					
					var layout = $("#title-overview-widget-layout");
					var info = layout.find(".infobar");
					response.genres = [];
					
					info.find('a').each(function(){
						var href = $(this).attr('href');
						if(href.indexOf('/genre/') != -1) {
							response.genres.push(href.split('/')[2]);
						}
					});
					
					var mpaaRatings = {'G':1,'PG':1,'PG-13':1,'R':1,'NC-17':1};
					info.find('img').each(function(){
						var title = $(this).attr('title');
						if(title.trim().length) {
							var rating = title.toUpperCase().replace(/_/g,'-'); 
							if(rating in mpaaRatings){
								response.mpaaRating = rating;
							}
						}
					});

					response.rating = $("#star-bar-user-rate b").text().trim();
					response.ratingScale = $("#star-bar-user-rate .mellow").text().trim().replace('/','');
					response.description = $("#overview-top>p").text().trim();
				}catch(err){}
				
				cb(err,response);
				
			});
		});
	},
	video:function(videoURL,cb){
		scraper.get(videoURL+'player',function(body,response){

			var document = scraper.loadDom(body);
			scraper.injectJquery(document,function(err,window){
				
				var $ = window.jQuery;
				response = {};
				try{
					var script = $("body script").eq(0).text();
					var lines = script.split(/[\r\n]+/)
						,data = {};
					
					for(var i =0,j=lines.length;i<j;i++){
						if(lines[i].trim().indexOf('so.addVariable') == 0){
							var cleaned = lines[i].replace('so.addVariable(','').replace(/\);$/,'');
							if(cleaned.indexOf('"file"') == 0) {
								response.file = decodeURIComponent(cleaned.replace(/"/g,'').split(',')[1]);
							} else if(cleaned.indexOf('"image"') == 0) {
								response.image = cleaned.replace(/"/g,'').split(',')[1];
							}
						}
					}
				}catch(err){}
				
				cb(err,response);
			});
		});
		//
		//script tag with file link
		//example video download link: http://www.totaleclips.com/Player/Bounce.aspx?eclipid=e18395&bitrateid=455&vendorid=102&type=.mp4
	},
	image:function(){
	
	}
}